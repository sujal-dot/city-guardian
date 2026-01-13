import { useState, useEffect } from 'react';
import { AlertTriangle, MapPin, Shield, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SafetyAlertProps {
  zone: string;
  riskLevel: 'critical' | 'high' | 'medium';
  onDismiss?: () => void;
}

export function SafetyAlert({ zone, riskLevel, onDismiss }: SafetyAlertProps) {
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
                <span>You are near {zone}</span>
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
            This area has a <span className={cn('font-semibold', style.text)}>{riskLevel} risk</span> rating
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

// Demo component that shows the alert
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
