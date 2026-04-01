import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SOSAlert {
  latitude: number;
  longitude: number;
}

const getBackendBaseCandidates = (baseUrl?: string) => {
  const candidates: string[] = [];
  if (!baseUrl) return candidates;

  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (!normalized) return candidates;

  candidates.push(normalized);

  try {
    const parsed = new URL(normalized);
    if (parsed.hostname === 'localhost') {
      parsed.hostname = '127.0.0.1';
      candidates.push(parsed.toString().replace(/\/+$/, ''));
    } else if (parsed.hostname === '127.0.0.1') {
      parsed.hostname = 'localhost';
      candidates.push(parsed.toString().replace(/\/+$/, ''));
    }
  } catch {
    // Keep only the configured URL when parsing fails.
  }

  return Array.from(new Set(candidates));
};

const getSOSApiBaseCandidates = (baseUrl?: string) => {
  const directCandidates = getBackendBaseCandidates(baseUrl);
  if (import.meta.env.DEV) {
    return Array.from(new Set(['/api', ...directCandidates]));
  }
  return directCandidates;
};

export function useSOS() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastAlert, setLastAlert] = useState<{ id: string; created_at: string } | null>(null);
  const backendUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
  const backendCandidates = useMemo(
    () => getSOSApiBaseCandidates(backendUrl),
    [backendUrl]
  );

  const handleSuccess = (id: string, createdAt: string) => {
    setLastAlert({
      id,
      created_at: createdAt,
    });

    toast.success('🚨 SOS Alert Sent!', {
      description: 'Emergency services have been notified. Help is on the way.',
      duration: 10000,
    });
  };

  const insertSOSAlert = async (userId: string | null, location: SOSAlert) => {
    return supabase
      .from('sos_alerts')
      .insert({
        user_id: userId,
        latitude: location.latitude,
        longitude: location.longitude,
        status: 'active',
      })
      .select()
      .single();
  };

  const sendSOSAlert = async (location: SOSAlert): Promise<boolean> => {
    setIsSubmitting(true);

    try {
      if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
        throw new Error('Valid coordinates are required');
      }

      const { data: { user } } = await supabase.auth.getUser();
      let lastBackendError = '';

      // Prefer backend service-role insert to avoid client-side RLS/session issues.
      for (const baseUrl of backendCandidates) {
        try {
          const response = await fetch(`${baseUrl}/sos-alerts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: location.latitude,
              longitude: location.longitude,
              status: 'active',
              user_id: user?.id ?? null,
            }),
          });

          const contentType = response.headers.get('content-type') ?? '';
          const responseData = contentType.includes('application/json')
            ? await response.json()
            : { error: await response.text() };

          if (!response.ok) {
            lastBackendError = responseData?.error || `Backend returned ${response.status}`;
            continue;
          }

          const createdAlert = (responseData as { alert?: { id?: string; created_at?: string } })?.alert;
          if (createdAlert?.id && createdAlert?.created_at) {
            handleSuccess(createdAlert.id, createdAlert.created_at);
          } else {
            handleSuccess(`SOS-${Date.now()}`, new Date().toISOString());
          }
          return true;
        } catch (error) {
          lastBackendError =
            error instanceof Error ? error.message : 'Failed to reach SOS backend.';
        }
      }

      // In demo/no-session mode, avoid client-side insert fallback because it can fail under RLS.
      if (!user) {
        throw new Error(
          lastBackendError || 'SOS backend is unavailable. Start `npm run server` and retry.'
        );
      }

      // First try direct insert so SOS works even when edge functions are not running.
      const directInsert = await insertSOSAlert(user?.id ?? null, location);
      if (!directInsert.error && directInsert.data) {
        handleSuccess(directInsert.data.id, directInsert.data.created_at);
        return true;
      }

      if (directInsert.error) {
        throw new Error(
          lastBackendError
            ? `${lastBackendError}. ${directInsert.error.message}`
            : directInsert.error.message
        );
      }

      throw new Error(lastBackendError || 'Unable to submit SOS alert.');
    } catch (err) {
      console.error('Error sending SOS alert:', err);
      toast.error('Failed to send SOS alert', {
        description: err instanceof Error ? err.message : 'Please call emergency services directly: 100',
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    sendSOSAlert,
    isSubmitting,
    lastAlert,
  };
}
