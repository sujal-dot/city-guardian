import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
const STATUS_OPTIONS = ['reported', 'investigating', 'resolved', 'closed'] as const;

interface NewIncidentDialogProps {
  onCreated?: () => void;
}

export function NewIncidentDialog({ onCreated }: NewIncidentDialogProps) {
  const { toast } = useToast();
  const { activeRole } = useAuthContext();
  const backendUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;

  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [incidentType, setIncidentType] = useState('');
  const [severity, setSeverity] = useState<(typeof SEVERITY_OPTIONS)[number]>('medium');
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('reported');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [description, setDescription] = useState('');
  const [assignedOfficer, setAssignedOfficer] = useState('');

  const resetForm = () => {
    setTitle('');
    setIncidentType('');
    setSeverity('medium');
    setStatus('reported');
    setLocationName('');
    setLatitude('');
    setLongitude('');
    setDescription('');
    setAssignedOfficer('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!title || !incidentType || !locationName || !latitude || !longitude) {
      toast({
        title: 'Missing details',
        description: 'Title, type, location, and coordinates are required.',
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
      const { data: { user } } = await supabase.auth.getUser();

      const payload = {
        title,
        incident_type: incidentType,
        severity,
        status,
        incident_source: activeRole === 'admin' ? 'admin' : 'police',
        location_name: locationName,
        latitude: lat,
        longitude: lng,
        description: description || null,
        assigned_officer: assignedOfficer || null,
        reported_by: user?.id ?? null,
      };

      if (backendUrl) {
        const response = await fetch(`${backendUrl}/incidents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(responseData?.error || 'Failed to create incident.');
        }
      } else {
        if (!user) {
          throw new Error('Please sign in or set VITE_BACKEND_URL to use the backend.');
        }

        const { error } = await supabase
          .from('incidents')
          .insert(payload);

        if (error) {
          throw error;
        }
      }

      toast({
        title: 'Incident created',
        description: 'The incident has been logged successfully.',
      });

      resetForm();
      setOpen(false);
      onCreated?.();
    } catch (error) {
      toast({
        title: 'Failed to create incident',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          resetForm();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Incident
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Incident</DialogTitle>
          <DialogDescription>
            Log a new incident for monitoring and response coordination.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="incident-title">Title</Label>
              <Input
                id="incident-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Short incident title"
                className="bg-secondary/50"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="incident-type">Incident Type</Label>
              <Select value={incidentType} onValueChange={setIncidentType} required>
                <SelectTrigger id="incident-type">
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
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="incident-severity">Severity</Label>
              <Select
                value={severity}
                onValueChange={(value) => setSeverity(value as (typeof SEVERITY_OPTIONS)[number])}
                required
              >
                <SelectTrigger id="incident-severity">
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
            <div className="space-y-2">
              <Label htmlFor="incident-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as (typeof STATUS_OPTIONS)[number])}
                required
              >
                <SelectTrigger id="incident-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="incident-officer">Assigned Officer</Label>
              <Input
                id="incident-officer"
                value={assignedOfficer}
                onChange={(event) => setAssignedOfficer(event.target.value)}
                placeholder="Optional"
                className="bg-secondary/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="incident-location">Location</Label>
            <Input
              id="incident-location"
              value={locationName}
              onChange={(event) => setLocationName(event.target.value)}
              placeholder="Location name or landmark"
              className="bg-secondary/50"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="incident-lat">Latitude</Label>
              <Input
                id="incident-lat"
                type="number"
                step="0.000001"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
                placeholder="19.1860"
                className="bg-secondary/50"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="incident-lng">Longitude</Label>
              <Input
                id="incident-lng"
                type="number"
                step="0.000001"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
                placeholder="72.9750"
                className="bg-secondary/50"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="incident-description">Description</Label>
            <Textarea
              id="incident-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Additional details about the incident"
              className="min-h-[100px] bg-secondary/50"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Create Incident'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
