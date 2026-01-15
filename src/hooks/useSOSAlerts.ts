import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SOSAlert {
  id: string;
  user_id: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

export const useSOSAlerts = () => {
  const [alerts, setAlerts] = useState<SOSAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('sos_alerts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setAlerts(data || []);
    }
    setIsLoading(false);
  };

  const updateAlertStatus = async (alertId: string, status: string) => {
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
    fetchAlerts();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('sos_alerts_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sos_alerts' },
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    alerts,
    isLoading,
    error,
    updateAlertStatus,
    refetch: fetchAlerts,
  };
};
