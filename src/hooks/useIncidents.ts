import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Incident {
  id: string;
  title: string;
  description: string | null;
  incident_source: string;
  incident_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'reported' | 'investigating' | 'resolved' | 'closed';
  location_name: string;
  latitude: number;
  longitude: number;
  assigned_officer: string | null;
  created_at: string;
  updated_at: string;
}

export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIncidents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setIncidents(data as Incident[]);
    } catch (err) {
      console.error('Error fetching incidents:', err);
      setError('Failed to fetch incidents');
    } finally {
      setIsLoading(false);
    }
  };

  // Subscribe to real-time updates
  useEffect(() => {
    fetchIncidents();

    const channel = supabase
      .channel('incidents_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incidents',
        },
        () => {
          fetchIncidents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    incidents,
    isLoading,
    error,
    refetch: fetchIncidents,
  };
}
