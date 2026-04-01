import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, MapPin, Send, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGeolocation } from '@/hooks/useGeolocation';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/contexts/AuthContext';

const INCIDENT_TYPES = [
  'Theft',
  'Assault',
  'Burglary',
  'Vandalism',
  'Cyber Crime',
  'Public Disturbance',
  'Traffic Violation',
  'Suspicious Activity',
  'Other',
];

const SEVERITY_OPTIONS = ['low', 'medium', 'high', 'critical'] as const;

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

const getIncidentApiBaseCandidates = (baseUrl?: string) => {
  const directCandidates = getBackendBaseCandidates(baseUrl);
  if (import.meta.env.DEV) {
    return Array.from(new Set(['/api', ...directCandidates]));
  }
  return directCandidates;
};

export function CitizenIncidentForm() {
  const { toast } = useToast();
  const { session } = useAuthContext();
  const { getCurrentPosition } = useGeolocation();
  const backendUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
  const backendCandidates = useMemo(
    () => getIncidentApiBaseCandidates(backendUrl),
    [backendUrl]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [incidentRef, setIncidentRef] = useState('');
  const [title, setTitle] = useState('');
  const [incidentType, setIncidentType] = useState('');
  const [severity, setSeverity] = useState<(typeof SEVERITY_OPTIONS)[number]>('medium');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [description, setDescription] = useState('');
  const hasAttemptedAutoLocation = useRef(false);

  const resetForm = () => {
    setTitle('');
    setIncidentType('');
    setSeverity('medium');
    setLocationName('');
    setLatitude('');
    setLongitude('');
    setDescription('');
  };

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'object' && error !== null) {
      if ('message' in error && typeof (error as { message?: unknown }).message === 'string') {
        return (error as { message: string }).message;
      }
      if ('error' in error && typeof (error as { error?: unknown }).error === 'string') {
        return (error as { error: string }).error;
      }
      if ('details' in error && typeof (error as { details?: unknown }).details === 'string') {
        return (error as { details: string }).details;
      }
    }

    return 'Please try again.';
  };

  const handleGetLocation = useCallback(async (options?: { silent?: boolean }) => {
    const { silent = false } = options ?? {};
    setIsGettingLocation(true);
    try {
      const position = await getCurrentPosition();
      setLatitude(position.latitude.toFixed(6));
      setLongitude(position.longitude.toFixed(6));
      if (!locationName) {
        setLocationName(`Near ${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`);
      }
    } catch {
      if (!silent) {
        toast({
          title: 'Location unavailable',
          description: 'Please enter coordinates manually.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsGettingLocation(false);
    }
  }, [getCurrentPosition, locationName, toast]);

  useEffect(() => {
    if (hasAttemptedAutoLocation.current) return;
    hasAttemptedAutoLocation.current = true;
    void handleGetLocation({ silent: true });
  }, [handleGetLocation]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!title || !incidentType || !locationName || !latitude || !longitude) {
      toast({
        title: 'Missing details',
        description: 'Title, type, location, latitude, and longitude are required.',
        variant: 'destructive',
      });
      return;
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast({
        title: 'Invalid coordinates',
        description: 'Latitude and longitude must be valid numbers.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const authenticatedUserId = session?.user?.id ?? null;
      const payload = {
        title: title.trim(),
        incident_type: incidentType,
        severity,
        status: 'reported' as const,
        incident_source: 'citizen',
        location_name: locationName.trim(),
        latitude: lat,
        longitude: lng,
        description: description.trim() || null,
        // In demo/mock role mode there may be no real auth session; backend can still accept null.
        reported_by: authenticatedUserId,
        assigned_officer: null,
      };

      const insertViaSupabase = async () => {
        if (!authenticatedUserId) {
          throw new Error(
            'Incident backend is offline. Start `npm run server` and try again.'
          );
        }

        const { error } = await supabase.from('incidents').insert(payload);
        if (error) throw error;
      };

      if (backendCandidates.length > 0) {
        try {
          let lastBackendError = 'Failed to submit incident.';
          let submitted = false;

          for (const baseUrl of backendCandidates) {
            try {
              const response = await fetch(`${baseUrl}/incidents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });

              const contentType = response.headers.get('content-type') ?? '';
              const responseData = contentType.includes('application/json')
                ? await response.json()
                : { error: await response.text() };

              if (!response.ok) {
                lastBackendError = responseData?.error || `Backend returned ${response.status}`;
                continue;
              }

              submitted = true;
              break;
            } catch (requestError) {
              lastBackendError =
                requestError instanceof Error ? requestError.message : 'Backend request failed.';
            }
          }

          if (!submitted) {
            throw new Error(lastBackendError);
          }
        } catch (error) {
          const isNetworkFailure =
            error instanceof TypeError ||
            (error instanceof Error &&
              /failed to fetch|networkerror|load failed/i.test(error.message));

          if (!isNetworkFailure) {
            throw error;
          }

          if (!authenticatedUserId) {
            throw new Error(
              'Incident backend is offline. Start `npm run server` and try again.'
            );
          }

          await insertViaSupabase();
        }
      } else {
        if (!authenticatedUserId) {
          throw new Error(
            'Set VITE_BACKEND_URL to the backend server or sign in with a real account.'
          );
        }
        await insertViaSupabase();
      }

      const ref = `INC-${Date.now().toString().slice(-6)}`;
      setIncidentRef(ref);
      setIsSubmitted(true);
      resetForm();

      toast({
        title: 'Incident reported',
        description: 'Authorities can now view this as a citizen-reported incident.',
      });
    } catch (error) {
      toast({
        title: 'Failed to report incident',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="card-command p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-full bg-risk-safe/20 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-risk-safe" />
          </div>
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">Incident Submitted</h3>
        <p className="text-muted-foreground mb-4">
          Your report has been sent and marked as citizen-reported for admin review.
        </p>
        <div className="bg-secondary rounded-lg p-4 mb-6">
          <p className="text-sm text-muted-foreground">Reference ID</p>
          <p className="text-2xl font-mono font-bold text-primary">{incidentRef}</p>
        </div>
        <Button
          onClick={() => {
            setIsSubmitted(false);
            setIncidentRef('');
            void handleGetLocation({ silent: true });
          }}
          variant="outline"
        >
          Report Another Incident
        </Button>
      </div>
    );
  }

  return (
    <div className="card-command p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">Report Incident</h3>
        <p className="text-sm text-muted-foreground">
          Submit a verified citizen incident directly to the admin dashboard.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="citizen-incident-title">Title</Label>
          <Input
            id="citizen-incident-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Short title for the incident"
            className="bg-secondary/50"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="citizen-incident-type">Incident Type</Label>
            <Select value={incidentType} onValueChange={setIncidentType} required>
              <SelectTrigger id="citizen-incident-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {INCIDENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="citizen-incident-severity">Severity</Label>
            <Select
              value={severity}
              onValueChange={(value) => setSeverity(value as (typeof SEVERITY_OPTIONS)[number])}
              required
            >
              <SelectTrigger id="citizen-incident-severity">
                <SelectValue placeholder="Select severity" />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="citizen-incident-location">Location</Label>
          <Input
            id="citizen-incident-location"
            value={locationName}
            onChange={(event) => setLocationName(event.target.value)}
            placeholder="Landmark or area"
            className="bg-secondary/50"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
          <div className="space-y-2">
            <Label htmlFor="citizen-incident-lat">Latitude</Label>
            <Input
              id="citizen-incident-lat"
              type="number"
              step="0.000001"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
              placeholder="19.186000"
              className="bg-secondary/50"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="citizen-incident-lng">Longitude</Label>
            <Input
              id="citizen-incident-lng"
              type="number"
              step="0.000001"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
              placeholder="72.975000"
              className="bg-secondary/50"
              required
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void handleGetLocation();
              }}
              disabled={isGettingLocation}
              className="w-full md:w-auto"
            >
              {isGettingLocation ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="citizen-incident-description">Description</Label>
          <Textarea
            id="citizen-incident-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe what happened, suspicious activity, and people/vehicles involved."
            className="min-h-[120px] bg-secondary/50"
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Submit Citizen Incident
            </>
          )}
        </Button>

        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-primary" />
          Your report appears in admin as <span className="font-semibold text-foreground">Reported by Citizen</span>.
        </div>
      </form>
    </div>
  );
}
