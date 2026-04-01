import { useState } from 'react';
import { Phone, AlertTriangle, MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSOS } from '@/hooks/useSOS';
import { useGeolocation } from '@/hooks/useGeolocation';
import { toast } from 'sonner';

const GEOLOCATION_ERROR = {
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
} as const;

function getLocationErrorMessage(error: unknown): { title: string; description: string } {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: number }).code;

    switch (code) {
      case GEOLOCATION_ERROR.PERMISSION_DENIED:
        return {
          title: 'Location permission denied',
          description: 'Allow location access in browser/site settings and try again.',
        };
      case GEOLOCATION_ERROR.POSITION_UNAVAILABLE:
        return {
          title: 'Location unavailable',
          description: 'Turn on GPS/location services and try again.',
        };
      case GEOLOCATION_ERROR.TIMEOUT:
        return {
          title: 'Location request timed out',
          description: 'Move to an open area and try SOS again.',
        };
      default:
        break;
    }
  }

  return {
    title: 'Location required for SOS',
    description: 'Enable location permission and try again.',
  };
}

export function SOSButton() {
  const [isActive, setIsActive] = useState(false);
  const { sendSOSAlert, isSubmitting } = useSOS();
  const { getCurrentPosition } = useGeolocation();

  const handleSOS = async () => {
    try {
      // Fetch live coordinates immediately when SOS is pressed.
      let location: { latitude: number; longitude: number };
      try {
        location = await getCurrentPosition();
      } catch (error) {
        const message = getLocationErrorMessage(error);
        toast.error(message.title, {
          description: message.description,
        });
        return;
      }

      const success = await sendSOSAlert(location);

      if (success) {
        setIsActive(true);
        // Reset after 10 seconds
        setTimeout(() => setIsActive(false), 10000);
      }
    } catch (error) {
      console.error('SOS error:', error);
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* SOS Button */}
      <button
        onClick={handleSOS}
        disabled={isSubmitting || isActive}
        className={cn(
          'relative group',
          isSubmitting && 'cursor-wait',
          isActive && 'cursor-not-allowed'
        )}
      >
        {/* Outer ring animation */}
        <div className="absolute inset-0 rounded-full animate-pulse-ring bg-destructive/30" />
        <div
          className="absolute inset-0 rounded-full animate-pulse-ring bg-destructive/20"
          style={{ animationDelay: '0.5s' }}
        />

        {/* Main button */}
        <div
          className={cn(
            'relative flex h-40 w-40 items-center justify-center rounded-full transition-all duration-300',
            'bg-gradient-to-br from-destructive to-risk-high',
            'shadow-glow-danger',
            !isSubmitting && !isActive && 'hover:scale-105 active:scale-95',
            isActive && 'from-risk-safe to-green-600'
          )}
        >
          {isSubmitting ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-12 w-12 text-destructive-foreground animate-spin" />
              <span className="text-sm font-medium text-destructive-foreground">
                Sending...
              </span>
            </div>
          ) : isActive ? (
            <div className="flex flex-col items-center gap-2">
              <Phone className="h-12 w-12 text-destructive-foreground animate-bounce" />
              <span className="text-sm font-bold text-destructive-foreground">
                HELP COMING
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <AlertTriangle className="h-16 w-16 text-destructive-foreground" />
              <span className="text-2xl font-bold text-destructive-foreground tracking-wider">
                SOS
              </span>
            </div>
          )}
        </div>
      </button>

      {/* Status text */}
      <div className="mt-6 text-center">
        {isActive ? (
          <div className="flex items-center gap-2 text-risk-safe">
            <MapPin className="h-5 w-5 animate-bounce" />
            <span className="font-medium">Location shared with authorities</span>
          </div>
        ) : (
          <p className="text-muted-foreground">
            Tap to send emergency alert with your location
          </p>
        )}
      </div>

      {/* Emergency contacts */}
      <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-md">
        <a
          href="tel:100"
          className="flex items-center justify-center gap-2 p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
        >
          <Phone className="h-5 w-5 text-primary" />
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">Police</p>
            <p className="text-lg font-bold text-primary">100</p>
          </div>
        </a>
        <a
          href="tel:112"
          className="flex items-center justify-center gap-2 p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
        >
          <Phone className="h-5 w-5 text-risk-high" />
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">Emergency</p>
            <p className="text-lg font-bold text-risk-high">112</p>
          </div>
        </a>
      </div>
    </div>
  );
}
