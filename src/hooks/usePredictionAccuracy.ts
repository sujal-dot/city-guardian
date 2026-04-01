import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MonthlyAccuracyPoint {
  month: string;
  predicted: number;
  actual: number;
  accuracy: number;
  variance: number;
}

export interface WeeklyAccuracyPoint {
  week: string;
  predicted: number;
  actual: number;
  accuracy: number;
}

export interface ZoneAccuracyPoint {
  zone: string;
  accuracy: number;
  incidents: number;
}

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const formatMonthLabel = (date: Date, includeYear: boolean) => {
  const label = date.toLocaleString('en-US', { month: 'short' });
  if (!includeYear) return label;
  return `${label} '${String(date.getFullYear()).slice(-2)}`;
};

const calculateAccuracy = (predicted: number, actual: number) => {
  if (predicted === 0) return actual === 0 ? 100 : 0;
  return Math.max(0, Math.round(100 - (Math.abs(predicted - actual) / predicted) * 100));
};

const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export function usePredictionAccuracy() {
  const [monthlyData, setMonthlyData] = useState<MonthlyAccuracyPoint[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyAccuracyPoint[]>([]);
  const [zoneAccuracy, setZoneAccuracy] = useState<ZoneAccuracyPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadAccuracyData = async () => {
      setIsLoading(true);
      try {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 11);
        const startDateIso = startDate.toISOString().split('T')[0];

        const [{ data: crimeData, error: crimeError }, { data: incidents, error: incidentError }] = await Promise.all([
          supabase
            .from('crime_data')
            .select('zone_name, latitude, longitude, risk_score, incident_count, recorded_date')
            .gte('recorded_date', startDateIso),
          supabase
            .from('incidents')
            .select('created_at, latitude, longitude')
            .gte('created_at', startDate.toISOString()),
        ]);

        if (crimeError) {
          console.error('Failed to load crime data for accuracy:', crimeError);
        }
        if (incidentError) {
          console.error('Failed to load incidents for accuracy:', incidentError);
        }

        if (!crimeData || !incidents) {
          setIsLoading(false);
          return;
        }

        const predictedByMonth = new Map<string, number>();
        crimeData.forEach((row) => {
          const key = monthKey(new Date(row.recorded_date));
          const current = predictedByMonth.get(key) ?? 0;
          predictedByMonth.set(key, current + Number(row.incident_count || 0));
        });

        const actualByMonth = new Map<string, number>();
        incidents.forEach((incident) => {
          const key = monthKey(new Date(incident.created_at));
          const current = actualByMonth.get(key) ?? 0;
          actualByMonth.set(key, current + 1);
        });

        const monthKeys = Array.from(new Set([...predictedByMonth.keys(), ...actualByMonth.keys()])).sort(
          (a, b) => new Date(`${a}-01`).getTime() - new Date(`${b}-01`).getTime()
        );

        const years = new Set(monthKeys.map((key) => key.split('-')[0]));
        const includeYear = years.size > 1;

        const monthlyPoints = monthKeys.map((key) => {
          const predicted = predictedByMonth.get(key) ?? 0;
          const actual = actualByMonth.get(key) ?? 0;
          const labelDate = new Date(`${key}-01T00:00:00`);
          return {
            month: formatMonthLabel(labelDate, includeYear),
            predicted,
            actual,
            accuracy: calculateAccuracy(predicted, actual),
            variance: actual - predicted,
          };
        });

        setMonthlyData(monthlyPoints);

        const latestMonthKey = monthKeys[monthKeys.length - 1] ?? monthKey(new Date());
        const [latestYear, latestMonth] = latestMonthKey.split('-').map(Number);
        const isInLatestMonth = (dateValue: string) => {
          const date = new Date(dateValue);
          return date.getFullYear() === latestYear && date.getMonth() + 1 === latestMonth;
        };

        const weeklyPredicted = new Map<number, number>();
        crimeData.forEach((row) => {
          if (!isInLatestMonth(row.recorded_date)) return;
          const weekIndex = Math.min(4, Math.floor((new Date(row.recorded_date).getDate() - 1) / 7) + 1);
          weeklyPredicted.set(weekIndex, (weeklyPredicted.get(weekIndex) ?? 0) + Number(row.incident_count || 0));
        });

        const weeklyActual = new Map<number, number>();
        incidents.forEach((incident) => {
          if (!isInLatestMonth(incident.created_at)) return;
          const weekIndex = Math.min(4, Math.floor((new Date(incident.created_at).getDate() - 1) / 7) + 1);
          weeklyActual.set(weekIndex, (weeklyActual.get(weekIndex) ?? 0) + 1);
        });

        const weeklyPoints: WeeklyAccuracyPoint[] = [1, 2, 3, 4].map((weekIndex) => {
          const predicted = weeklyPredicted.get(weekIndex) ?? 0;
          const actual = weeklyActual.get(weekIndex) ?? 0;
          return {
            week: `Week ${weekIndex}`,
            predicted,
            actual,
            accuracy: calculateAccuracy(predicted, actual),
          };
        });

        setWeeklyData(weeklyPoints);

        const latestMonthZones = crimeData
          .filter((row) => isInLatestMonth(row.recorded_date))
          .sort((a, b) => Number(b.risk_score) - Number(a.risk_score))
          .slice(0, 5);

        const zoneAccuracyPoints = latestMonthZones.map((zone) => {
          const predicted = Number(zone.incident_count || 0);
          const zoneLat = Number(zone.latitude);
          const zoneLng = Number(zone.longitude);
          const actual = incidents.filter((incident) => {
            if (!isInLatestMonth(incident.created_at)) return false;
            const distance = calculateDistanceKm(zoneLat, zoneLng, Number(incident.latitude), Number(incident.longitude));
            return distance <= 1.2;
          }).length;

          return {
            zone: zone.zone_name,
            accuracy: calculateAccuracy(predicted, actual),
            incidents: actual,
          };
        });

        setZoneAccuracy(zoneAccuracyPoints);
      } catch (error) {
        console.error('Failed to build prediction accuracy data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAccuracyData();
  }, []);

  return {
    monthlyData,
    weeklyData,
    zoneAccuracy,
    isLoading,
  };
}
