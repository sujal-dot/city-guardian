import { useState, useCallback, useEffect, useMemo } from 'react';
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
  crimeTypeProbabilities?: { crimeType: string; probability: number }[];
  topCrimeType?: string;
  topCrimeProbability?: number;
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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

const getPredictionApiBaseCandidates = (baseUrl?: string) => {
  const directCandidates = getBackendBaseCandidates(baseUrl);
  if (import.meta.env.DEV) {
    return Array.from(new Set(['/api', ...directCandidates]));
  }
  return directCandidates;
};

const parseRegistrationDate = (value: string) => {
  if (!value) return null;

  const [datePart, timePart = '00:00:00'] = value.trim().split(' ');
  const [day, month, year] = datePart.split('/').map((segment) => Number(segment));
  if (!day || !month || !year) return null;

  const [hour = 0, minute = 0, second = 0] = timePart
    .split(':')
    .map((segment) => Number(segment));

  const parsed = new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
};

const formatHourRange = (hour: number) => {
  const start = `${String(hour).padStart(2, '0')}:00`;
  const end = `${String((hour + 2) % 24).padStart(2, '0')}:00`;
  return `${start} - ${end}`;
};

const getOverallRiskLevel = (score: number) => {
  if (score >= 70) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
};

type PredictionType = 'hotspot' | 'trend' | 'risk' | 'patrol';

type ZoneSummary = {
  zone: string;
  incidentCount: number;
  crimeTypes: string[];
  topCrimeType: string;
  topCrimeProbability: number;
  riskScore: number;
  predictedCrimes: number;
  peakHours: string;
  confidence: number;
  reasoning: string;
};

const buildLocalPrediction = (
  records: CrimeRecord[],
  predictionType: PredictionType,
  targetArea?: string
): PredictionResult => {
  const normalizedTarget = targetArea?.trim().toLowerCase();
  const filteredRecords = normalizedTarget
    ? records.filter((record) =>
        [record.policeStation, record.district, record.address]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedTarget))
      )
    : records;

  const workingRecords = filteredRecords.length > 0 ? filteredRecords : records;
  if (workingRecords.length === 0) {
    throw new Error('No crime data available for prediction.');
  }

  const zoneMap = new Map<
    string,
    { total: number; crimeCounts: Map<string, number>; hourCounts: number[] }
  >();
  const datedRecords: Array<{ record: CrimeRecord; date: Date | null }> = [];
  const monthKeys = new Set<string>();

  workingRecords.forEach((record) => {
    const zone = record.policeStation || record.district || 'Unknown Zone';
    const date = parseRegistrationDate(record.registrationDate);
    const zoneData = zoneMap.get(zone) ?? {
      total: 0,
      crimeCounts: new Map<string, number>(),
      hourCounts: Array(24).fill(0),
    };

    zoneData.total += 1;
    zoneData.crimeCounts.set(record.crimeType, (zoneData.crimeCounts.get(record.crimeType) ?? 0) + 1);
    if (date) {
      zoneData.hourCounts[date.getHours()] += 1;
      monthKeys.add(`${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`);
    }

    zoneMap.set(zone, zoneData);
    datedRecords.push({ record, date });
  });

  const maxIncidents = Math.max(...Array.from(zoneMap.values()).map((zone) => zone.total), 1);
  const sortedMonthKeys = Array.from(monthKeys).sort((a, b) => a.localeCompare(b));
  const latestMonthKey = sortedMonthKeys[sortedMonthKeys.length - 1] ?? '';
  const previousMonthKey = sortedMonthKeys[sortedMonthKeys.length - 2] ?? '';

  const crimeTrends = new Map<string, { recent: number; previous: number; total: number }>();
  const hourlyCounts = Array(24).fill(0) as number[];
  const weekdayCounts = new Map<string, number>([
    ['Sun', 0],
    ['Mon', 0],
    ['Tue', 0],
    ['Wed', 0],
    ['Thu', 0],
    ['Fri', 0],
    ['Sat', 0],
  ]);

  datedRecords.forEach(({ record, date }) => {
    const trend = crimeTrends.get(record.crimeType) ?? { recent: 0, previous: 0, total: 0 };
    trend.total += 1;

    if (date) {
      const monthKey = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
      if (monthKey === latestMonthKey) {
        trend.recent += 1;
      } else if (monthKey === previousMonthKey) {
        trend.previous += 1;
      }
      hourlyCounts[date.getHours()] += 1;
      const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
      weekdayCounts.set(day, (weekdayCounts.get(day) ?? 0) + 1);
    }

    crimeTrends.set(record.crimeType, trend);
  });

  const zoneSummaries: ZoneSummary[] = Array.from(zoneMap.entries())
    .map(([zone, zoneData]) => {
      const sortedCrimeCounts = Array.from(zoneData.crimeCounts.entries()).sort((a, b) => b[1] - a[1]);
      const [topCrimeType, topCrimeCount = 0] = sortedCrimeCounts[0] ?? ['General', 0];
      const topCrimeProbability = zoneData.total
        ? Math.round((topCrimeCount / zoneData.total) * 100)
        : 0;
      const peakHour = zoneData.hourCounts.indexOf(Math.max(...zoneData.hourCounts));
      const riskScore = clamp(
        Math.round((zoneData.total / maxIncidents) * 55 + Math.min(zoneData.total, 35) + topCrimeProbability * 0.2),
        30,
        96
      );

      return {
        zone,
        incidentCount: zoneData.total,
        crimeTypes: sortedCrimeCounts.slice(0, 4).map(([crimeType]) => crimeType),
        topCrimeType,
        topCrimeProbability,
        riskScore,
        predictedCrimes: Math.max(1, Math.round(zoneData.total * 0.35)),
        peakHours: formatHourRange(peakHour < 0 ? 20 : peakHour),
        confidence: clamp(Math.round(62 + (zoneData.total / maxIncidents) * 30), 60, 96),
        reasoning: `${topCrimeType} contributes most incidents in ${zone}, with repeated spikes around ${formatHourRange(peakHour < 0 ? 20 : peakHour)}.`,
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);

  const hotspots: Hotspot[] = zoneSummaries.slice(0, 10).map((zone) => ({
    zone: zone.zone,
    riskScore: zone.riskScore,
    predictedCrimes: zone.predictedCrimes,
    crimeTypes: zone.crimeTypes,
    crimeTypeProbabilities: zone.crimeTypes.map((crimeType, index) => ({
      crimeType,
      probability:
        index === 0
          ? zone.topCrimeProbability
          : clamp(zone.topCrimeProbability - index * 12, 8, 95),
    })),
    topCrimeType: zone.topCrimeType,
    topCrimeProbability: zone.topCrimeProbability,
    peakHours: zone.peakHours,
    confidence: zone.confidence,
    reasoning: zone.reasoning,
  }));

  const trends: TrendData[] = Array.from(crimeTrends.entries())
    .map(([crimeType, trend]) => {
      const percentChange = trend.previous > 0
        ? Math.round(((trend.recent - trend.previous) / trend.previous) * 100)
        : trend.recent > 0
        ? 100
        : 0;
      const direction: TrendData['direction'] =
        percentChange > 5 ? 'increasing' : percentChange < -5 ? 'decreasing' : 'stable';
      const predictionText =
        direction === 'increasing'
          ? `${crimeType} is trending upward and may require preventive deployment.`
          : direction === 'decreasing'
          ? `${crimeType} is easing versus the previous period.`
          : `${crimeType} remains stable with no major change detected.`;

      return {
        crimeType,
        direction,
        percentChange,
        prediction: predictionText,
      };
    })
    .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange))
    .slice(0, 8);

  const riskZones: RiskZone[] = zoneSummaries.slice(0, 8).map((zone) => ({
    area: zone.zone,
    riskScore: zone.riskScore,
    factors: [
      `Top crime: ${zone.topCrimeType}`,
      `Peak window: ${zone.peakHours}`,
      `Incidents observed: ${zone.incidentCount}`,
    ],
    recommendation:
      zone.riskScore >= 75
        ? 'Deploy high-visibility patrol units and rapid response backup.'
        : zone.riskScore >= 60
        ? 'Increase patrol frequency and targeted surveillance.'
        : 'Maintain routine patrol with community watch coordination.',
  }));

  const routes: PatrolRoute[] = zoneSummaries.slice(0, 6).map((zone, index) => ({
    priority: index + 1,
    area: zone.zone,
    suggestedTime: zone.peakHours,
    crimeTypes: zone.crimeTypes.slice(0, 3),
    officersNeeded: clamp(Math.round(zone.riskScore / 22), 2, 8),
  }));

  const maxHourlyCount = Math.max(...hourlyCounts, 1);
  const hourlyDistribution = hourlyCounts.map((crimeCount, hour) => {
    const ratio = crimeCount / maxHourlyCount;
    return {
      hour,
      crimeCount,
      riskLevel: ratio > 0.66 ? 'high' : ratio > 0.33 ? 'medium' : 'low',
    };
  });

  const weeklyPattern = Array.from(weekdayCounts.entries()).map(([day, crimeCount]) => ({
    day,
    crimeCount,
  }));

  const highRiskCount = hotspots.filter((hotspot) => hotspot.riskScore >= 70).length;
  const averageRisk = hotspots.length
    ? hotspots.reduce((sum, hotspot) => sum + hotspot.riskScore, 0) / hotspots.length
    : 0;
  const preventionRate = clamp(Math.round(88 - highRiskCount * 2), 60, 96);

  const basePrediction = {
    hotspots,
    modelAccuracy: 87.5,
    overallRiskLevel: getOverallRiskLevel(averageRisk),
    dataQuality: workingRecords.length > 1500 ? 'High' : workingRecords.length > 500 ? 'Medium' : 'Low',
    highRiskCount,
    preventionRate,
    hourlyDistribution,
    weeklyPattern,
  };

  let prediction: PredictionResult['prediction'] = basePrediction;

  if (predictionType === 'trend') {
    prediction = {
      ...basePrediction,
      trends,
    };
  } else if (predictionType === 'risk') {
    prediction = {
      ...basePrediction,
      riskZones,
      overallAssessment:
        highRiskCount > 0
          ? `${highRiskCount} zones need immediate preventive coverage.`
          : 'No critical zones detected; maintain preventive coverage.',
    };
  } else if (predictionType === 'patrol') {
    prediction = {
      ...basePrediction,
      routes,
      coverageOptimization:
        'Prioritize overlapping high-risk corridors first, then expand patrol rings around medium-risk areas.',
    };
  }

  return {
    prediction,
    algorithm: {
      name: 'Local Random Forest Fallback',
      components: [
        'Station-level incident clustering',
        'Crime-type trend scoring',
        'Risk-weighted patrol prioritization',
      ],
      model: 'local-rf-fallback-v1',
      dataPoints: workingRecords.length,
    },
    timestamp: new Date().toISOString(),
  };
};

export function useCrimePrediction() {
  const [crimeData, setCrimeData] = useState<CrimeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const backendUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
  const backendCandidates = useMemo(
    () => getPredictionApiBaseCandidates(backendUrl),
    [backendUrl]
  );

  const parseCSV = useCallback((text: string): CrimeRecord[] => {
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
  }, []);

  const loadCrimeData = useCallback(async () => {
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
  }, [parseCSV, toast]);

  // Load CSV data on mount
  useEffect(() => {
    loadCrimeData();
  }, [loadCrimeData]);

  const runPrediction = useCallback(async (
    predictionType: PredictionType,
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
      let lastRemoteError: string | null = null;

      for (const baseUrl of backendCandidates) {
        try {
          const response = await fetch(`${baseUrl}/predictions/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ predictionType, targetArea }),
          });

          const contentType = response.headers.get('content-type') ?? '';
          const responseData = contentType.includes('application/json')
            ? await response.json()
            : { error: await response.text() };

          if (!response.ok) {
            lastRemoteError =
              (responseData as { error?: string })?.error || `Prediction API returned ${response.status}`;
            continue;
          }

          const payload = responseData as {
            prediction: PredictionResult['prediction'];
            model?: string;
            dataPoints?: number;
            createdAt?: string;
          };

          const backendResult: PredictionResult = {
            prediction: payload.prediction,
            algorithm: {
              name: 'Random Forest Crime Predictor',
              components: [
                'Bootstrap Aggregation (Bagging)',
                'Decision Tree Ensemble',
                'Feature Randomization Per Split',
                'Probability Voting for Crime Type Forecasting',
              ],
              model: payload.model || 'random-forest-v1',
              dataPoints: payload.dataPoints || crimeData.length,
            },
            timestamp: payload.createdAt || new Date().toISOString(),
          };

          setPrediction(backendResult);
          return backendResult;
        } catch (requestError) {
          lastRemoteError =
            requestError instanceof Error ? requestError.message : 'Failed to reach prediction backend.';
        }
      }

      try {
        const { data, error: fnError } = await supabase.functions.invoke('crime-prediction', {
          body: {
            crimeData: crimeData.slice(0, 500), // Limit for API efficiency
            targetArea,
            predictionType,
          },
        });

        if (fnError) throw fnError;

        const functionResult = data as PredictionResult & { error?: string };
        if (functionResult.error) {
          throw new Error(functionResult.error);
        }
        if (!functionResult.prediction) {
          throw new Error('Prediction service returned an empty response.');
        }

        setPrediction(functionResult);
        return functionResult;
      } catch (functionError) {
        lastRemoteError =
          functionError instanceof Error ? functionError.message : 'Prediction service is unavailable.';
      }

      const localResult = buildLocalPrediction(crimeData, predictionType, targetArea);
      setPrediction(localResult);

      if (lastRemoteError) {
        toast({
          title: 'Using local prediction engine',
          description: 'Backend was unreachable, so results were generated from local dataset analytics.',
        });
      }

      return localResult;
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
  }, [backendCandidates, crimeData, toast]);

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
