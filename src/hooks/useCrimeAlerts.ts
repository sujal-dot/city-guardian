import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CrimeAlert {
  id: string;
  incidentId: string;
  incidentTitle: string;
  incidentType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  latitude: number;
  longitude: number;
  matchedHotspot: {
    zone: string;
    riskScore: number;
    distance: number;
  };
  timestamp: string;
  isRead: boolean;
}

interface Hotspot {
  zone: string;
  latitude: number;
  longitude: number;
  riskScore: number;
}

// Calculate distance between two coordinates using Haversine formula (returns km)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Alert radius threshold in km
const ALERT_RADIUS_KM = 2;

export function useCrimeAlerts() {
  const [alerts, setAlerts] = useState<CrimeAlert[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();

  // Load hotspots from high_risk_zones table
  useEffect(() => {
    const loadHotspots = async () => {
      const { data, error } = await supabase
        .from('high_risk_zones')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.error('Failed to load hotspots:', error);
        return;
      }

      setHotspots(data.map(zone => ({
        zone: zone.zone_name,
        latitude: Number(zone.latitude),
        longitude: Number(zone.longitude),
        riskScore: zone.risk_level === 'critical' ? 85 : zone.risk_level === 'high' ? 70 : 50,
      })));
    };

    loadHotspots();
  }, []);

  // Check if incident matches any hotspot
  const checkIncidentAgainstHotspots = useCallback((incident: {
    id: string;
    title: string;
    incident_type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    location_name: string;
    latitude: number;
    longitude: number;
    created_at: string;
  }) => {
    for (const hotspot of hotspots) {
      const distance = calculateDistance(
        Number(incident.latitude),
        Number(incident.longitude),
        hotspot.latitude,
        hotspot.longitude
      );

      if (distance <= ALERT_RADIUS_KM) {
        const newAlert: CrimeAlert = {
          id: `alert-${incident.id}-${Date.now()}`,
          incidentId: incident.id,
          incidentTitle: incident.title,
          incidentType: incident.incident_type,
          severity: incident.severity,
          location: incident.location_name,
          latitude: Number(incident.latitude),
          longitude: Number(incident.longitude),
          matchedHotspot: {
            zone: hotspot.zone,
            riskScore: hotspot.riskScore,
            distance: Math.round(distance * 1000), // Convert to meters
          },
          timestamp: new Date().toISOString(),
          isRead: false,
        };

        setAlerts(prev => [newAlert, ...prev].slice(0, 50)); // Keep last 50 alerts
        setUnreadCount(prev => prev + 1);

        // Show toast notification
        toast({
          title: '🚨 Hotspot Alert!',
          description: `New ${incident.severity} incident "${incident.title}" detected ${Math.round(distance * 1000)}m from ${hotspot.zone} hotspot`,
          variant: 'destructive',
        });

        return newAlert;
      }
    }
    return null;
  }, [hotspots, toast]);

  // Subscribe to real-time incident changes
  useEffect(() => {
    if (hotspots.length === 0) return;

    const channel = supabase
      .channel('incident_alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'incidents',
        },
        (payload) => {
          const newIncident = payload.new as any;
          checkIncidentAgainstHotspots(newIncident);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hotspots, checkIncidentAgainstHotspots]);

  const markAsRead = useCallback((alertId: string) => {
    setAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId ? { ...alert, isRead: true } : alert
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setAlerts(prev => prev.map(alert => ({ ...alert, isRead: true })));
    setUnreadCount(0);
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
    setUnreadCount(0);
  }, []);

  return {
    alerts,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAlerts,
    hotspots,
  };
}
