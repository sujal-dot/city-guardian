import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CrimeData {
  id: string;
  zone_name: string;
  latitude: number;
  longitude: number;
  crime_type: string;
  risk_score: number;
  incident_count: number;
  recorded_date: string;
  created_at: string;
}

export function useCrimeData() {
  const [crimeData, setCrimeData] = useState<CrimeData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCrimeData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('crime_data')
        .select('*')
        .order('risk_score', { ascending: false });

      if (fetchError) throw fetchError;

      setCrimeData(data as CrimeData[]);
    } catch (err) {
      console.error('Error fetching crime data:', err);
      setError('Failed to fetch crime data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCrimeData();
  }, []);

  return {
    crimeData,
    isLoading,
    error,
    refetch: fetchCrimeData,
  };
}
