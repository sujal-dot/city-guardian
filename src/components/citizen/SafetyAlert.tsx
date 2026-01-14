import { useState, useEffect } from 'react';
import { AlertTriangle, MapPin, Shield, X, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useGeolocation } from '@/hooks/useGeolocation';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface SafetyAlertProps {
  zone: string;
  riskLevel: 'critical' | 'high' | 'medium';
  distance?: number;
  onDismiss?: () => void;
}

export function SafetyAlert({ zone, riskLevel, distance, onDismiss }: SafetyAlertProps) {
  const [isVisible, setIsVisible] = useState(true);

  const alertStyles = {
    critical: {
      bg: 'bg-risk-critical/10',
      border: 'border-risk-critical',
      text: 'text-risk-critical',
      icon: 'text-risk-critical',
    },
    high: {
      bg: 'bg-risk-high/10',
      border: 'border-risk-high',
      text: 'text-risk-high',
      icon: 'text-risk-high',
    },
    medium: {
      bg: 'bg-risk-medium/10',
      border: 'border-risk-medium',
      text: 'text-risk-medium',
      icon: 'text-risk-medium',
    },
  };

  const style = alertStyles[riskLevel];

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border-2 p-4 animate-fade-in',
        style.bg,
        style.border
      )}
    >
      {/* Animated background pulse */}
      <div className="absolute inset-0 animate-pulse opacity-20">
        <div
          className={cn('h-full w-full', riskLevel === 'critical' && 'bg-risk-critical')}
        />
      </div>

      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full',
                style.bg
              )}
            >
              <AlertTriangle className={cn('h-5 w-5', style.icon)} />
            </div>
            <div>
              <h4 className={cn('text-base font-semibold', style.text)}>
                ⚠️ High-Risk Area Alert
              </h4>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>
                  {zone} {distance && `(${distance}m away)`}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <p>
            This area has a{' '}
            <span className={cn('font-semibold', style.text)}>{riskLevel} risk</span> rating
            based on recent incidents. Please stay vigilant.
          </p>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button variant="outline" size="sm" className="flex-1">
            <Shield className="h-4 w-4 mr-2" />
            View Safety Tips
          </Button>
          <Button size="sm" className="flex-1" variant="destructive">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Report Incident
          </Button>
        </div>
      </div>
    </div>
  );
}

// Live geofencing alert component
export function GeofenceAlerts() {
  const {
    isTracking,
    startTracking,
    stopTracking,
    nearbyZones,
    latitude,
    longitude,
    error,
  } = useGeolocation();

  const [dismissedZones, setDismissedZones] = useState<Set<string>>(new Set());

  const handleDismissZone = (zoneId: string) => {
    setDismissedZones((prev) => new Set([...prev, zoneId]));
  };

  const visibleZones = nearbyZones.filter((zone) => !dismissedZones.has(zone.id));

  return (
    <div className="space-y-4">
      {/* Tracking Toggle */}
      <div className="card-command p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                isTracking ? 'bg-primary/20' : 'bg-secondary'
              )}
            >
              <Navigation
                className={cn(
                  'h-5 w-5',
                  isTracking ? 'text-primary animate-pulse' : 'text-muted-foreground'
                )}
              />
            </div>
            <div>
              <Label htmlFor="tracking" className="text-base font-medium">
                Real-time Safety Tracking
              </Label>
              <p className="text-sm text-muted-foreground">
                {isTracking
                  ? 'Monitoring your location for nearby high-risk zones'
                  : 'Enable to receive alerts when entering risky areas'}
              </p>
            </div>
          </div>
          <Switch
            id="tracking"
            checked={isTracking}
            onCheckedChange={(checked) => (checked ? startTracking() : stopTracking())}
          />
        </div>

        {isTracking && latitude && longitude && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-risk-safe animate-pulse" />
              <span>
                Location: {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 p-2 bg-destructive/10 rounded-lg text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      {/* Active Zone Alerts */}
      {visibleZones.map((zone) => (
        <SafetyAlert
          key={zone.id}
          zone={zone.zone_name}
          riskLevel={zone.risk_level as 'critical' | 'high' | 'medium'}
          distance={zone.distance}
          onDismiss={() => handleDismissZone(zone.id)}
        />
      ))}
    </div>
  );
}

// Demo component that shows the alert (for when not using real geolocation)
export function SafetyAlertDemo() {
  const [showAlert, setShowAlert] = useState(true);

  useEffect(() => {
    // Simulate geofencing detection after 2 seconds
    const timer = setTimeout(() => setShowAlert(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!showAlert) return null;

  return (
    <div className="mb-6">
      <SafetyAlert
        zone="Thane Station Area"
        riskLevel="high"
        onDismiss={() => setShowAlert(false)}
      />
    </div>
  );
}
