import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SOSAlert {
  id: string;
  user_id: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

const SOS_POLL_INTERVAL_MS = 7000;

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

export const useSOSAlerts = () => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
  const backendCandidates = useMemo(
    () => getSOSApiBaseCandidates(backendUrl),
    [backendUrl]
  );
  const [alerts, setAlerts] = useState<SOSAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async (options?: { silent?: boolean }) => {
    const { silent = false } = options ?? {};
    if (!silent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session && backendCandidates.length > 0) {
        let responseData: unknown = null;
        let fetchedFromBackend = false;
        let lastBackendError = 'Failed to fetch SOS alerts.';

        for (const baseUrl of backendCandidates) {
          try {
            const response = await fetch(`${baseUrl}/sos-alerts`);
            responseData = await response.json().catch(() => ({}));
            if (!response.ok) {
              lastBackendError =
                (responseData as { error?: string })?.error || `Backend returned ${response.status}`;
              continue;
            }
            fetchedFromBackend = true;
            break;
          } catch (backendError) {
            lastBackendError =
              backendError instanceof Error ? backendError.message : 'Failed to reach SOS backend.';
          }
        }

        if (fetchedFromBackend) {
          const backendAlerts = Array.isArray((responseData as { alerts?: unknown[] })?.alerts)
            ? ((responseData as { alerts: unknown[] }).alerts as SOSAlert[])
            : [];
          setAlerts(backendAlerts);
          return;
        }

        console.warn('SOS backend fetch failed, trying direct Supabase query:', lastBackendError);
      }

      const { data, error: fetchError } = await supabase
        .from('sos_alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setAlerts((data || []) as SOSAlert[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch SOS alerts';
      setError(message);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [backendCandidates]);

  const updateAlertStatus = async (alertId: string, status: string) => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session && backendCandidates.length > 0) {
      let lastBackendError = 'Failed to update SOS alert.';

      for (const baseUrl of backendCandidates) {
        try {
          const response = await fetch(`${baseUrl}/sos-alerts/${alertId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          });
          const responseData = await response.json().catch(() => ({}));
          if (!response.ok) {
            lastBackendError =
              (responseData as { error?: string })?.error || `Backend returned ${response.status}`;
            continue;
          }

          await fetchAlerts();
          return;
        } catch (backendError) {
          lastBackendError =
            backendError instanceof Error ? backendError.message : 'Failed to reach SOS backend.';
        }
      }

      throw new Error(lastBackendError);
    }

    const updateData: { status: string; resolved_at?: string } = { status };
    if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from('sos_alerts')
      .update(updateData)
      .eq('id', alertId);

    if (error) {
      throw error;
    }

    await fetchAlerts();
  };

  useEffect(() => {
    void fetchAlerts();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let pollInterval: number | null = null;
    let disposed = false;

    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (disposed) return;

      if (!session) {
        pollInterval = window.setInterval(() => {
          void fetchAlerts({ silent: true });
        }, SOS_POLL_INTERVAL_MS);
        return;
      }

      channel = supabase
        .channel('sos_alerts_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sos_alerts' },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newAlert = payload.new as SOSAlert;
              const coordinates =
                newAlert.latitude !== null && newAlert.longitude !== null
                  ? `${newAlert.latitude.toFixed(6)}, ${newAlert.longitude.toFixed(6)}`
                  : 'Location unavailable';

              toast.error('New SOS alert received', {
                description: coordinates,
                duration: 10000,
              });
            }
            void fetchAlerts({ silent: true });
          }
        )
        .subscribe();
    };

    void setupRealtime();

    const handleFocus = () => {
      void fetchAlerts({ silent: true });
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      disposed = true;
      window.removeEventListener('focus', handleFocus);
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (pollInterval !== null) {
        window.clearInterval(pollInterval);
      }
    };
  }, [fetchAlerts]);

  return {
    alerts,
    isLoading,
    error,
    updateAlertStatus,
    refetch: fetchAlerts,
  };
};
