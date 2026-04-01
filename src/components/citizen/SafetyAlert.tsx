import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  MapPin,
  Shield,
  X,
  Navigation,
  Bell,
  Mail,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useGeolocation } from '@/hooks/useGeolocation';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuthContext } from '@/contexts/AuthContext';

const APP_NOTIFY_KEY = 'city-guardian.app-notifications-enabled';
const EMAIL_NOTIFY_KEY = 'city-guardian.email-notifications-enabled';
const ALERT_EMAIL_KEY = 'city-guardian.alert-email';

const getStoredBoolean = (key: string, fallback: boolean) => {
  if (typeof window === 'undefined') return fallback;
  const value = window.localStorage.getItem(key);
  if (value === null) return fallback;
  return value === 'true';
};

const getStoredString = (key: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback;
  return window.localStorage.getItem(key) || fallback;
};

interface SafetyAlertProps {
  zone: string;
  riskLevel: 'critical' | 'high' | 'medium';
  distance?: number;
  likelyCrimeType?: string;
  probability?: number;
  source?: 'manual' | 'predicted';
  onDismiss?: () => void;
}

export function SafetyAlert({
  zone,
  riskLevel,
  distance,
  likelyCrimeType,
  probability,
  source,
  onDismiss,
}: SafetyAlertProps) {
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
                Crime Probability Alert
              </h4>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>
                  {zone} {distance && `(${distance}m away)`}
                </span>
              </div>
              {source && (
                <Badge variant="outline" className="mt-2 text-xs">
                  {source === 'predicted' ? 'Predicted zone' : 'Manual high-risk zone'}
                </Badge>
              )}
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
            Current risk is{' '}
            <span className={cn('font-semibold', style.text)}>{riskLevel}</span>.
          </p>
          {likelyCrimeType && probability ? (
            <p>
              Random Forest predicts a <span className="font-semibold text-foreground">{probability}%</span>{' '}
              probability of <span className="font-semibold text-foreground">{likelyCrimeType}</span>{' '}
              in this area.
            </p>
          ) : (
            <p>Stay vigilant and avoid isolated routes where possible.</p>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button variant="outline" size="sm" className="flex-1">
            <Shield className="h-4 w-4 mr-2" />
            Safety Tips
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

export function GeofenceAlerts() {
  const { user } = useAuthContext();
  const [appNotificationsEnabled, setAppNotificationsEnabled] = useState(() =>
    getStoredBoolean(APP_NOTIFY_KEY, true)
  );
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(() =>
    getStoredBoolean(EMAIL_NOTIFY_KEY, false)
  );
  const [alertEmail, setAlertEmail] = useState(() =>
    getStoredString(ALERT_EMAIL_KEY, user?.email || '')
  );
  const [dismissedZones, setDismissedZones] = useState<Set<string>>(new Set());

  const {
    isTracking,
    startTracking,
    stopTracking,
    nearbyZones,
    travelAlerts,
    clearTravelAlerts,
    latitude,
    longitude,
    error,
  } = useGeolocation({
    alertPreferences: {
      appNotificationsEnabled,
      emailAlertsEnabled,
      emailAddress: alertEmail,
    },
  });

  useEffect(() => {
    if (!alertEmail && user?.email) {
      setAlertEmail(user.email);
    }
  }, [alertEmail, user?.email]);

  useEffect(() => {
    window.localStorage.setItem(APP_NOTIFY_KEY, String(appNotificationsEnabled));
  }, [appNotificationsEnabled]);

  useEffect(() => {
    window.localStorage.setItem(EMAIL_NOTIFY_KEY, String(emailAlertsEnabled));
  }, [emailAlertsEnabled]);

  useEffect(() => {
    window.localStorage.setItem(ALERT_EMAIL_KEY, alertEmail);
  }, [alertEmail]);

  const handleDismissZone = (zoneId: string) => {
    setDismissedZones((prev) => new Set([...prev, zoneId]));
  };

  const handleAppNotificationToggle = async (checked: boolean) => {
    setAppNotificationsEnabled(checked);
    if (checked && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const visibleZones = nearbyZones.filter((zone) => !dismissedZones.has(zone.id));

  return (
    <div className="space-y-4">
      <div className="card-command p-4">
        <div className="flex items-start justify-between gap-4">
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
                  ? 'Monitoring predicted and high-risk zones near your route.'
                  : 'Enable tracking to receive probability-based crime alerts.'}
              </p>
            </div>
          </div>
          <Switch
            id="tracking"
            checked={isTracking}
            onCheckedChange={(checked) => (checked ? startTracking() : stopTracking())}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <Label htmlFor="app-alerts" className="text-sm font-medium">
                  App Notifications
                </Label>
              </div>
              <Switch
                id="app-alerts"
                checked={appNotificationsEnabled}
                onCheckedChange={handleAppNotificationToggle}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Shows browser notifications when entering a predicted crime zone.
            </p>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <Label htmlFor="email-alerts" className="text-sm font-medium">
                  Email Alerts
                </Label>
              </div>
              <Switch
                id="email-alerts"
                checked={emailAlertsEnabled}
                onCheckedChange={setEmailAlertsEnabled}
              />
            </div>
            <Input
              type="email"
              value={alertEmail}
              onChange={(event) => setAlertEmail(event.target.value)}
              placeholder="you@example.com"
              className="bg-secondary/50 h-8"
              disabled={!emailAlertsEnabled}
            />
          </div>
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

      {travelAlerts.length > 0 && (
        <div className="card-command p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-foreground">Recent Travel Alerts</h4>
            <Button variant="ghost" size="sm" onClick={clearTravelAlerts}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
          {travelAlerts.slice(0, 3).map((alert) => (
            <div key={alert.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{alert.zoneName}</span>
                <Badge variant="outline">{alert.riskLevel}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {alert.probability}% chance of {alert.likelyCrimeType} • {alert.distance}m away
              </p>
            </div>
          ))}
        </div>
      )}

      {visibleZones.map((zone) => (
        <SafetyAlert
          key={zone.id}
          zone={zone.zone_name}
          riskLevel={zone.risk_level as 'critical' | 'high' | 'medium'}
          distance={zone.distance}
          likelyCrimeType={zone.likelyCrimeType}
          probability={zone.likelihoodProbability}
          source={zone.source}
          onDismiss={() => handleDismissZone(zone.id)}
        />
      ))}
    </div>
  );
}

export function SafetyAlertDemo() {
  const [showAlert, setShowAlert] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowAlert(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!showAlert) return null;

  return (
    <div className="mb-6">
      <SafetyAlert
        zone="Thane Station Area"
        riskLevel="high"
        likelyCrimeType="Theft"
        probability={64}
        source="predicted"
        onDismiss={() => setShowAlert(false)}
      />
    </div>
  );
}
