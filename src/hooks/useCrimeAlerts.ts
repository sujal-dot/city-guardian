import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CrimeAlert {
  id: string;
  incidentId: string | null;
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
    radiusMeters: number;
    source: 'prediction' | 'geofence';
  };
  timestamp: string;
  isRead: boolean;
}

interface CrimeAlertRow {
  id: string;
  incident_id: string | null;
  incident_title: string;
  incident_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location_name: string;
  latitude: number;
  longitude: number;
  matched_zone: string;
  matched_risk_score: number;
  matched_distance_meters: number;
  matched_radius_meters: number;
  source: 'prediction' | 'geofence';
  created_at: string;
  is_read: boolean;
}

const mapAlertRow = (row: CrimeAlertRow): CrimeAlert => ({
  id: row.id,
  incidentId: row.incident_id,
  incidentTitle: row.incident_title,
  incidentType: row.incident_type,
  severity: row.severity,
  location: row.location_name,
  latitude: Number(row.latitude),
  longitude: Number(row.longitude),
  matchedHotspot: {
    zone: row.matched_zone,
    riskScore: Number(row.matched_risk_score),
    distance: Number(row.matched_distance_meters),
    radiusMeters: Number(row.matched_radius_meters),
    source: row.source,
  },
  timestamp: row.created_at,
  isRead: row.is_read,
});

export function useCrimeAlerts({ enabled = true }: { enabled?: boolean } = {}) {
  const [alerts, setAlerts] = useState<CrimeAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();

  const fetchAlerts = useCallback(async () => {
    if (!enabled) return;

    const { data, error } = await supabase
      .from('crime_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Failed to load crime alerts:', error);
      return;
    }

    const mapped = (data || []).map((row) => mapAlertRow(row as CrimeAlertRow));
    setAlerts(mapped);
    setUnreadCount(mapped.filter((alert) => !alert.isRead).length);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setAlerts([]);
      setUnreadCount(0);
      return;
    }
    fetchAlerts();
  }, [enabled, fetchAlerts]);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('crime_alerts_feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crime_alerts',
        },
        (payload) => {
          const newAlert = mapAlertRow(payload.new as CrimeAlertRow);
          setAlerts((prev) => [newAlert, ...prev].slice(0, 50));
          if (!newAlert.isRead) {
            setUnreadCount((prev) => prev + 1);
          }

          toast({
            title: '🚨 Hotspot Alert!',
            description: `New ${newAlert.severity} incident "${newAlert.incidentTitle}" detected ${newAlert.matchedHotspot.distance}m from ${newAlert.matchedHotspot.zone}`,
            variant: 'destructive',
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'crime_alerts',
        },
        () => {
          fetchAlerts();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'crime_alerts',
        },
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, fetchAlerts, toast]);

  const markAsRead = useCallback(async (alertId: string) => {
    const { error } = await supabase
      .from('crime_alerts')
      .update({ is_read: true })
      .eq('id', alertId);

    if (error) {
      toast({
        title: 'Failed to update alert',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setAlerts((prev) =>
      prev.map((alert) => (alert.id === alertId ? { ...alert, isRead: true } : alert))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, [toast]);

  const markAllAsRead = useCallback(async () => {
    const { error } = await supabase
      .from('crime_alerts')
      .update({ is_read: true })
      .eq('is_read', false);

    if (error) {
      toast({
        title: 'Failed to update alerts',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setAlerts((prev) => prev.map((alert) => ({ ...alert, isRead: true })));
    setUnreadCount(0);
  }, [toast]);

  const clearAlerts = useCallback(async () => {
    const { error } = await supabase
      .from('crime_alerts')
      .delete()
      .not('id', 'is', null);

    if (error) {
      toast({
        title: 'Failed to clear alerts',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setAlerts([]);
    setUnreadCount(0);
  }, [toast]);

  return {
    alerts,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAlerts,
  };
}
