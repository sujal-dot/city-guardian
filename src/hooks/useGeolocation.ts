import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

interface NearbyZone extends HighRiskZone {
  distance: number;
}

// Haversine formula to calculate distance between two points
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    isTracking: false,
  });

  const [highRiskZones, setHighRiskZones] = useState<HighRiskZone[]>([]);
  const [nearbyZones, setNearbyZones] = useState<NearbyZone[]>([]);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [alertedZones, setAlertedZones] = useState<Set<string>>(new Set());

  // Fetch high-risk zones from database
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

      setHighRiskZones(data as HighRiskZone[]);
    };

    fetchHighRiskZones();

    // Subscribe to real-time updates
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

  // Check if user is near any high-risk zones
  const checkNearbyZones = useCallback(
    (latitude: number, longitude: number) => {
      const nearby: NearbyZone[] = [];

      highRiskZones.forEach((zone) => {
        const distance = calculateDistance(
          latitude,
          longitude,
          Number(zone.latitude),
          Number(zone.longitude)
        );

        // Check if within zone radius + 200m buffer for early warning
        if (distance <= zone.radius_meters + 200) {
          nearby.push({
            ...zone,
            distance: Math.round(distance),
          });

          // Show alert if entering a new zone
          if (!alertedZones.has(zone.id)) {
            const severityEmoji =
              zone.risk_level === 'critical'
                ? '🚨'
                : zone.risk_level === 'high'
                ? '⚠️'
                : '⚡';

            toast.warning(`${severityEmoji} High-Risk Area Alert`, {
              description: `You are near ${zone.zone_name} (${zone.risk_level} risk, ${Math.round(distance)}m away)`,
              duration: 10000,
            });

            setAlertedZones((prev) => new Set([...prev, zone.id]));
          }
        }
      });

      // Sort by distance
      nearby.sort((a, b) => a.distance - b.distance);
      setNearbyZones(nearby);

      // Clear alerted zones that are no longer nearby
      const nearbyIds = new Set(nearby.map((z) => z.id));
      setAlertedZones((prev) => {
        const newSet = new Set<string>();
        prev.forEach((id) => {
          if (nearbyIds.has(id)) {
            newSet.add(id);
          }
        });
        return newSet;
      });
    },
    [highRiskZones, alertedZones]
  );

  // Start tracking location
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: 'Geolocation is not supported by your browser',
      }));
      return;
    }

    setState((prev) => ({ ...prev, isTracking: true, error: null }));

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        setState((prev) => ({
          ...prev,
          latitude,
          longitude,
          accuracy,
          error: null,
        }));

        // Check nearby zones
        checkNearbyZones(latitude, longitude);
      },
      (error) => {
        let errorMessage = 'Unable to retrieve your location';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }

        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isTracking: false,
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    setWatchId(id);
  }, [checkNearbyZones]);

  // Stop tracking location
  const stopTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }

    setState((prev) => ({ ...prev, isTracking: false }));
    setAlertedZones(new Set());
  }, [watchId]);

  // Get current position once
  const getCurrentPosition = useCallback((): Promise<{
    latitude: number;
    longitude: number;
  }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setState((prev) => ({
            ...prev,
            latitude,
            longitude,
            accuracy: position.coords.accuracy,
          }));
          checkNearbyZones(latitude, longitude);
          resolve({ latitude, longitude });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }, [checkNearbyZones]);

  // Cleanup on unmount
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
    highRiskZones,
    startTracking,
    stopTracking,
    getCurrentPosition,
  };
}
