import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SOSAlert {
  latitude?: number;
  longitude?: number;
}

export function useSOS() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastAlert, setLastAlert] = useState<{ id: string; created_at: string } | null>(null);

  const sendSOSAlert = async (location?: SOSAlert): Promise<boolean> => {
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // For anonymous submissions, use the rate-limited edge function
      if (!user) {
        const response = await supabase.functions.invoke('submit-anonymous', {
          body: {
            type: 'sos',
            data: {
              latitude: location?.latitude || null,
              longitude: location?.longitude || null,
            },
          },
        });

        if (response.error) {
          throw new Error(response.error.message || 'Failed to send SOS');
        }

        if (response.data?.error) {
          if (response.data.error === 'Rate limit exceeded') {
            toast.error('Too many SOS submissions', {
              description: response.data.message || 'Please call emergency services directly: 100',
            });
            return false;
          }
          throw new Error(response.data.error);
        }

        setLastAlert({
          id: response.data.id,
          created_at: new Date().toISOString(),
        });

        toast.success('🚨 SOS Alert Sent!', {
          description: 'Emergency services have been notified. Help is on the way.',
          duration: 10000,
        });

        return true;
      }

      // For authenticated users, use direct insert
      const { data, error } = await supabase
        .from('sos_alerts')
        .insert({
          user_id: user.id,
          latitude: location?.latitude || null,
          longitude: location?.longitude || null,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      setLastAlert({
        id: data.id,
        created_at: data.created_at,
      });

      toast.success('🚨 SOS Alert Sent!', {
        description: 'Emergency services have been notified. Help is on the way.',
        duration: 10000,
      });

      return true;
    } catch (err) {
      console.error('Error sending SOS alert:', err);
      toast.error('Failed to send SOS alert', {
        description: 'Please call emergency services directly: 100',
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
