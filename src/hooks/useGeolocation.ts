import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCrimeData } from '@/hooks/useCrimeData';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  isTracking: boolean;
}

interface HighRiskZone {
  id: string;
  zone_name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  risk_level: 'medium' | 'high' | 'critical';
}

interface CrimeProbability {
  crimeType: string;
  probability: number;
}

interface AlertZone extends HighRiskZone {
  source: 'manual' | 'predicted';
  likelyCrimeType?: string;
  likelihoodProbability?: number;
  crimeProbabilities?: CrimeProbability[];
}

interface NearbyZone extends AlertZone {
  distance: number;
}

export interface TravelCrimeAlert {
  id: string;
  zoneId: string;
  zoneName: string;
  riskLevel: 'medium' | 'high' | 'critical';
  source: 'manual' | 'predicted';
  distance: number;
  likelyCrimeType: string;
  probability: number;
  latitude: number;
  longitude: number;
  timestamp: string;
}

interface AlertPreferences {
  appNotificationsEnabled?: boolean;
  emailAlertsEnabled?: boolean;
  emailAddress?: string;
}

interface UseGeolocationOptions {
  alertPreferences?: AlertPreferences;
}

interface CachedPosition {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

const FALLBACK_CACHE_MAX_AGE_MS = 2 * 60 * 1000;
const GEOLOCATION_ERROR_CODE = {
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
} as const;
let lastKnownPosition: CachedPosition | null = null;

const cachePosition = (position: {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}) => {
  lastKnownPosition = {
    ...position,
    timestamp: Date.now(),
  };
};

const getRecentCachedPosition = (maxAgeMs = FALLBACK_CACHE_MAX_AGE_MS) => {
  if (!lastKnownPosition) return null;
  if (Date.now() - lastKnownPosition.timestamp > maxAgeMs) return null;
  return lastKnownPosition;
};

const getLocationTrackingErrorMessage = (code?: number) => {
  switch (code) {
    case GEOLOCATION_ERROR_CODE.PERMISSION_DENIED:
      return 'Location permission denied. Allow access in browser settings and try again.';
    case GEOLOCATION_ERROR_CODE.POSITION_UNAVAILABLE:
      return 'Unable to detect your location. Turn on location services and try again.';
    case GEOLOCATION_ERROR_CODE.TIMEOUT:
      return 'Location request timed out. Move to an open area and try again.';
    default:
      return 'Unable to retrieve your location';
  }
};

const getRiskLevelFromScore = (score: number): HighRiskZone['risk_level'] => {
  if (score >= 75) return 'critical';
  if (score >= 55) return 'high';
  return 'medium';
};

const getRadiusFromScore = (score: number, incidentCount: number) => {
  const clampedScore = Math.min(Math.max(score, 0), 100);
  const clampedIncidents = Math.min(Math.max(incidentCount, 0), 40);
  const base = 180;
  const scoreRadius = clampedScore * 5;
  const incidentRadius = clampedIncidents * 9;
  return Math.min(900, Math.round(base + scoreRadius + incidentRadius));
};

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const { crimeData } = useCrimeData();
  const backendUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
  const { alertPreferences } = options;
  const emailChannelWarned = useRef(false);

  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    isTracking: false,
  });

  const [manualZones, setManualZones] = useState<AlertZone[]>([]);
  const [nearbyZones, setNearbyZones] = useState<NearbyZone[]>([]);
  const [travelAlerts, setTravelAlerts] = useState<TravelCrimeAlert[]>([]);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [alertedZones, setAlertedZones] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchHighRiskZones = async () => {
      const { data, error } = await supabase
        .from('high_risk_zones')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching high-risk zones:', error);
        return;
      }

      const zones = (data as HighRiskZone[]).map((zone) => ({
        ...zone,
        source: 'manual' as const,
      }));
      setManualZones(zones);
    };

    fetchHighRiskZones();

    const channel = supabase
      .channel('high_risk_zones_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'high_risk_zones',
        },
        () => {
          fetchHighRiskZones();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const predictedZones = useMemo<AlertZone[]>(() => {
    const MIN_PREDICTION_SCORE = 50;
    const zoneMap = new Map<
      string,
      {
        zone_name: string;
        weightedLat: number;
        weightedLng: number;
        totalWeight: number;
        weightedRisk: number;
        crimeWeights: Map<string, number>;
      }
    >();

    crimeData
      .filter(
        (record) =>
          Number.isFinite(record.latitude) &&
          Number.isFinite(record.longitude) &&
          record.risk_score >= MIN_PREDICTION_SCORE
      )
      .forEach((record) => {
        const key = record.zone_name.trim().toLowerCase();
        const weight = Math.max(1, Number(record.incident_count || 1));

        if (!zoneMap.has(key)) {
          zoneMap.set(key, {
            zone_name: record.zone_name,
            weightedLat: 0,
            weightedLng: 0,
            totalWeight: 0,
            weightedRisk: 0,
            crimeWeights: new Map<string, number>(),
          });
        }

        const zone = zoneMap.get(key)!;
        zone.weightedLat += Number(record.latitude) * weight;
        zone.weightedLng += Number(record.longitude) * weight;
        zone.totalWeight += weight;
        zone.weightedRisk += Number(record.risk_score) * weight;
        zone.crimeWeights.set(
          record.crime_type,
          (zone.crimeWeights.get(record.crime_type) || 0) + weight
        );
      });

    return Array.from(zoneMap.entries()).map(([key, zone]) => {
      const avgRisk = zone.weightedRisk / Math.max(zone.totalWeight, 1);
      const crimeProbabilities = Array.from(zone.crimeWeights.entries())
        .map(([crimeType, weight]) => ({
          crimeType,
          probability: Number(((weight / zone.totalWeight) * 100).toFixed(1)),
        }))
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 3);

      return {
        id: `pred-${key}`,
        zone_name: zone.zone_name,
        latitude: zone.weightedLat / Math.max(zone.totalWeight, 1),
        longitude: zone.weightedLng / Math.max(zone.totalWeight, 1),
        radius_meters: getRadiusFromScore(avgRisk, zone.totalWeight),
        risk_level: getRiskLevelFromScore(avgRisk),
        source: 'predicted' as const,
        likelyCrimeType: crimeProbabilities[0]?.crimeType || 'Suspicious Activity',
        likelihoodProbability: crimeProbabilities[0]?.probability || 50,
        crimeProbabilities,
      };
    });
  }, [crimeData]);

  const allZones = useMemo(
    () => [...manualZones, ...predictedZones],
    [manualZones, predictedZones]
  );

  const sendTravelEmailAlert = useCallback(
    async (alert: TravelCrimeAlert) => {
      if (!alertPreferences?.emailAlertsEnabled || !alertPreferences?.emailAddress) {
        return;
      }

      if (!backendUrl) {
        if (!emailChannelWarned.current) {
          emailChannelWarned.current = true;
          toast.info('Email alerts need backend setup', {
            description: 'Set VITE_BACKEND_URL and server email variables to deliver travel alerts.',
          });
        }
        return;
      }

      try {
        const response = await fetch(`${backendUrl}/alerts/travel-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: alertPreferences.emailAddress,
            zoneName: alert.zoneName,
            distanceMeters: alert.distance,
            riskLevel: alert.riskLevel,
            likelyCrimeType: alert.likelyCrimeType,
            probability: alert.probability,
            latitude: alert.latitude,
            longitude: alert.longitude,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Email alert failed');
        }
      } catch (error) {
        console.error('Email alert error:', error);
      }
    },
    [alertPreferences?.emailAddress, alertPreferences?.emailAlertsEnabled, backendUrl]
  );

  const pushBrowserNotification = useCallback(
    async (alert: TravelCrimeAlert) => {
      if (!alertPreferences?.appNotificationsEnabled) return;
      if (!('Notification' in window)) return;

      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') return;

      new Notification('Crime Probability Alert', {
        body: `${alert.zoneName}: ${alert.probability}% chance of ${alert.likelyCrimeType}.`,
      });
    },
    [alertPreferences?.appNotificationsEnabled]
  );

  const checkNearbyZones = useCallback(
    (latitude: number, longitude: number) => {
      const nearby: NearbyZone[] = [];

      allZones.forEach((zone) => {
        const distance = calculateDistance(
          latitude,
          longitude,
          Number(zone.latitude),
          Number(zone.longitude)
        );

        if (distance <= zone.radius_meters + 200) {
          const roundedDistance = Math.round(distance);
          nearby.push({
            ...zone,
            distance: roundedDistance,
          });

          if (!alertedZones.has(zone.id)) {
            const likelyCrimeType = zone.likelyCrimeType || 'Suspicious Activity';
            const probability = zone.likelihoodProbability || 50;
            const alert: TravelCrimeAlert = {
              id: `${zone.id}-${Date.now()}`,
              zoneId: zone.id,
              zoneName: zone.zone_name,
              riskLevel: zone.risk_level,
              source: zone.source,
              distance: roundedDistance,
              likelyCrimeType,
              probability,
              latitude: Number(zone.latitude),
              longitude: Number(zone.longitude),
              timestamp: new Date().toISOString(),
            };

            const alertTitle =
              zone.source === 'predicted'
                ? 'Predicted Crime Alert'
                : 'High-Risk Area Alert';

            toast.warning(alertTitle, {
              description: `${zone.zone_name}: ${probability}% probability of ${likelyCrimeType} (${roundedDistance}m away).`,
              duration: 10000,
            });

            setTravelAlerts((prev) => [alert, ...prev].slice(0, 30));
            void pushBrowserNotification(alert);
            void sendTravelEmailAlert(alert);
            setAlertedZones((prev) => new Set([...prev, zone.id]));
          }
        }
      });

      nearby.sort((a, b) => a.distance - b.distance);
      setNearbyZones(nearby);

      const nearbyIds = new Set(nearby.map((zone) => zone.id));
      setAlertedZones((prev) => {
        const active = new Set<string>();
        prev.forEach((id) => {
          if (nearbyIds.has(id)) {
            active.add(id);
          }
        });
        return active;
      });
    },
    [allZones, alertedZones, pushBrowserNotification, sendTravelEmailAlert]
  );

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: 'Geolocation is not supported by your browser',
      }));
      return;
    }

    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }

    setState((prev) => ({ ...prev, isTracking: true, error: null }));

    const beginWatch = (positionOptions: PositionOptions, hasRetried = false): number => {
      let currentWatchId = -1;

      currentWatchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          cachePosition({ latitude, longitude, accuracy });

          setState((prev) => ({
            ...prev,
            latitude,
            longitude,
            accuracy,
            error: null,
            isTracking: true,
          }));

          checkNearbyZones(latitude, longitude);
        },
        (error) => {
          const shouldRetryWithLowAccuracy =
            !hasRetried &&
            (error.code === GEOLOCATION_ERROR_CODE.POSITION_UNAVAILABLE ||
              error.code === GEOLOCATION_ERROR_CODE.TIMEOUT);

          if (shouldRetryWithLowAccuracy) {
            navigator.geolocation.clearWatch(currentWatchId);
            const fallbackWatchId = beginWatch(
              {
                enableHighAccuracy: false,
                timeout: 20000,
                maximumAge: 120000,
              },
              true
            );
            setWatchId(fallbackWatchId);
            return;
          }

          const cachedPosition = getRecentCachedPosition(5 * 60 * 1000);
          if (cachedPosition) {
            setState((prev) => ({
              ...prev,
              latitude: cachedPosition.latitude,
              longitude: cachedPosition.longitude,
              accuracy: cachedPosition.accuracy,
              error: null,
              isTracking: true,
            }));
            checkNearbyZones(cachedPosition.latitude, cachedPosition.longitude);
            return;
          }

          setState((prev) => ({
            ...prev,
            error: getLocationTrackingErrorMessage(error.code),
            isTracking: false,
          }));
        },
        positionOptions
      );

      return currentWatchId;
    };

    const id = beginWatch({
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 10000,
    });

    setWatchId(id);
  }, [checkNearbyZones, watchId]);

  const stopTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }

    setState((prev) => ({ ...prev, isTracking: false, error: null }));
    setAlertedZones(new Set());
  }, [watchId]);

  const clearTravelAlerts = useCallback(() => {
    setTravelAlerts([]);
  }, []);

  const getCurrentPosition = useCallback(async (): Promise<{
    latitude: number;
    longitude: number;
  }> => {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported');
    }

    const requestPosition = (positionOptions: PositionOptions) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, positionOptions);
      });

    let position: GeolocationPosition | null = null;
    let lastError: unknown;

    try {
      position = await requestPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    } catch (error) {
      const geoError = error as GeolocationPositionError;
      const shouldRetryWithFallback =
        geoError?.code === GEOLOCATION_ERROR_CODE.POSITION_UNAVAILABLE ||
        geoError?.code === GEOLOCATION_ERROR_CODE.TIMEOUT;

      if (shouldRetryWithFallback) {
        try {
          // Fallback to cached/low-accuracy location when GPS lock is slow.
          position = await requestPosition({
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 60000,
          });
        } catch (fallbackError) {
          lastError = fallbackError;
        }
      } else {
        lastError = error;
      }
    }

    if (!position) {
      // Reuse a fresh location from another active hook instance (for example live tracking).
      const cachedPosition = getRecentCachedPosition();
      if (cachedPosition) {
        setState((prev) => ({
          ...prev,
          latitude: cachedPosition.latitude,
          longitude: cachedPosition.longitude,
          accuracy: cachedPosition.accuracy,
          error: null,
        }));
        checkNearbyZones(cachedPosition.latitude, cachedPosition.longitude);
        return {
          latitude: cachedPosition.latitude,
          longitude: cachedPosition.longitude,
        };
      }

      throw lastError ?? new Error('Unable to retrieve your location');
    }

    const { latitude, longitude } = position.coords;
    cachePosition({ latitude, longitude, accuracy: position.coords.accuracy });
    setState((prev) => ({
      ...prev,
      latitude,
      longitude,
      accuracy: position.coords.accuracy,
      error: null,
    }));
    checkNearbyZones(latitude, longitude);
    return { latitude, longitude };
  }, [checkNearbyZones]);

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  return {
    ...state,
    nearbyZones,
    travelAlerts,
    highRiskZones: allZones,
    predictedZones,
    manualZones,
    startTracking,
    stopTracking,
    clearTravelAlerts,
    getCurrentPosition,
  };
}
