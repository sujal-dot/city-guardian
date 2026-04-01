import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type IncidentStatus = Database['public']['Enums']['incident_status'];
type IncidentSeverity = Database['public']['Enums']['incident_severity'];
type IncidentSource = 'citizen' | 'police' | 'admin' | 'system';

interface Incident {
  id: string;
  title: string;
  description: string | null;
  incident_source: IncidentSource;
  reporter_label: string;
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

const formatReporterLabel = (source: IncidentSource) => {
  switch (source) {
    case 'citizen':
      return 'Reported by Citizen';
    case 'admin':
      return 'Reported by Admin';
    case 'system':
      return 'System Generated';
    default:
      return 'Reported by Police';
  }
};

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
      const mapped = (data || []).map((incident) => {
        const source = (incident.incident_source ?? 'police') as IncidentSource;
        return {
          ...incident,
          incident_source: source,
          reporter_label: formatReporterLabel(source),
        };
      });
      setIncidents(mapped);
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
