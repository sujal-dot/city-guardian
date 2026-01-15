import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type IncidentStatus = Database['public']['Enums']['incident_status'];
type IncidentSeverity = Database['public']['Enums']['incident_severity'];

interface Incident {
  id: string;
  title: string;
  description: string | null;
  incident_type: string;
  location_name: string;
  latitude: number;
  longitude: number;
  severity: IncidentSeverity;
  status: IncidentStatus;
  reported_by: string | null;
  assigned_officer: string | null;
  created_at: string;
  updated_at: string;
}

export const useAdminIncidents = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIncidents = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setIncidents(data || []);
    }
    setIsLoading(false);
  };

  const updateIncident = async (
    incidentId: string, 
    updates: { status?: IncidentStatus; assigned_officer?: string }
  ) => {
    const { error } = await supabase
      .from('incidents')
      .update(updates)
      .eq('id', incidentId);

    if (error) {
      throw error;
    }

    await fetchIncidents();
  };

  useEffect(() => {
    fetchIncidents();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('incidents_admin_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incidents' },
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
    updateIncident,
    refetch: fetchIncidents,
  };
};
