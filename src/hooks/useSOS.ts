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

      const { data, error } = await supabase
        .from('sos_alerts')
        .insert({
          user_id: user?.id || null,
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
