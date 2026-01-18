import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CrimeRecord {
  district: string;
  policeStation: string;
  year: number;
  crimeType: string;
  latitude: number;
  longitude: number;
  address: string;
  registrationDate: string;
}

export interface Hotspot {
  zone: string;
  riskScore: number;
  predictedCrimes: number;
  crimeTypes: string[];
  peakHours: string;
  confidence: number;
  reasoning: string;
}

export interface TrendData {
  crimeType: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  percentChange: number;
  prediction: string;
}

export interface RiskZone {
  area: string;
  riskScore: number;
  factors: string[];
  recommendation: string;
}

export interface PatrolRoute {
  priority: number;
  area: string;
  suggestedTime: string;
  crimeTypes: string[];
  officersNeeded: number;
}

export interface AlgorithmInfo {
  name: string;
  components: string[];
  model: string;
  dataPoints: number;
}

export interface PredictionResult {
  prediction: {
    hotspots?: Hotspot[];
    trends?: TrendData[];
    riskZones?: RiskZone[];
    routes?: PatrolRoute[];
    overallRiskLevel?: string;
    modelAccuracy?: number;
    dataQuality?: string;
    hourlyDistribution?: { hour: number; crimeCount: number; riskLevel: string }[];
    weeklyPattern?: { day: string; crimeCount: number }[];
    preventionRate?: number;
    highRiskCount?: number;
    overallAssessment?: string;
    coverageOptimization?: string;
  };
  algorithm: AlgorithmInfo;
  timestamp: string;
}

export function useCrimePrediction() {
  const [crimeData, setCrimeData] = useState<CrimeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Load CSV data on mount
  useEffect(() => {
    loadCrimeData();
  }, []);

  const loadCrimeData = async () => {
    setIsLoadingData(true);
    try {
      const response = await fetch('/data/crime_data.csv');
      const text = await response.text();
      const records = parseCSV(text);
      setCrimeData(records);
    } catch (err) {
      console.error('Failed to load crime data:', err);
      toast({
        title: 'Data Load Error',
        description: 'Failed to load crime data file.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const parseCSV = (text: string): CrimeRecord[] => {
    const lines = text.trim().split('\n');
    if (lines.length <= 1) return [];
    
    const records: CrimeRecord[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Handle CSV with quoted fields
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      // CSV columns: District(0), Police Station(1), Year(2), FIR No.(3), Registration Date(4), 
      // FIR No(5), Sections(6), Address(7), Crime_Section(8), Latitude(9), Longitude(10)
      const lat = parseFloat(values[9]);
      const lng = parseFloat(values[10]);
      
      if (values[8] && !isNaN(lat) && !isNaN(lng)) {
        records.push({
          district: values[0] || '',
          policeStation: values[1] || '',
          year: parseInt(values[2]) || 2024,
          crimeType: values[8] || '',
          latitude: lat,
          longitude: lng,
          address: values[7] || '',
          registrationDate: values[4] || '',
        });
      }
    }
    
    return records;
  };

  const runPrediction = useCallback(async (
    predictionType: 'hotspot' | 'trend' | 'risk' | 'patrol',
    targetArea?: string
  ) => {
    if (crimeData.length === 0) {
      toast({
        title: 'No Data',
        description: 'Crime data not loaded yet.',
        variant: 'destructive',
      });
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('crime-prediction', {
        body: {
          crimeData: crimeData.slice(0, 500), // Limit for API efficiency
          targetArea,
          predictionType,
        },
      });

      if (fnError) throw fnError;

      if (data.error) {
        throw new Error(data.error);
      }

      setPrediction(data);
      return data as PredictionResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Prediction failed';
      setError(message);
      toast({
        title: 'Prediction Error',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [crimeData, toast]);

  return {
    crimeData,
    isLoading,
    isLoadingData,
    prediction,
    error,
    runPrediction,
    dataStats: {
      totalRecords: crimeData.length,
      uniqueAreas: [...new Set(crimeData.map(r => r.policeStation))].length,
      crimeTypes: [...new Set(crimeData.map(r => r.crimeType))].length,
    },
  };
}
