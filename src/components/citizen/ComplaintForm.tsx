import { useState } from 'react';
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
import { MapPin, Send, Loader2, CheckCircle } from 'lucide-react';
import { useComplaints } from '@/hooks/useComplaints';
import { useGeolocation } from '@/hooks/useGeolocation';

const complaintTypes = [
  'Theft / Robbery',
  'Assault / Violence',
  'Suspicious Activity',
  'Cyber Crime',
  'Vandalism',
  'Noise Complaint',
  'Traffic Violation',
  'Missing Person',
  'Other',
];

export function ComplaintForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [lastComplaintId, setLastComplaintId] = useState<string>('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [location, setLocation] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [complaintType, setComplaintType] = useState('');
  const [description, setDescription] = useState('');

  const { submitComplaint, isLoading } = useComplaints();
  const { getCurrentPosition } = useGeolocation();

  const handleGetLocation = async () => {
    setIsGettingLocation(true);

    try {
      const position = await getCurrentPosition();
      setCoordinates({ lat: position.latitude, lng: position.longitude });

      // Reverse geocode to get address (simplified)
      setLocation(`Lat: ${position.latitude.toFixed(4)}, Lng: ${position.longitude.toFixed(4)}`);

      // In production, you'd use a geocoding API
      // For now, we'll just show coordinates
    } catch (error) {
      console.error('Error getting location:', error);
      setLocation('Unable to get location. Please enter manually.');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!complaintType || !description || !location) {
      return;
    }

    const success = await submitComplaint({
      complaint_type: complaintType,
      description,
      location_name: location,
      latitude: coordinates?.lat,
      longitude: coordinates?.lng,
    });

    if (success) {
      setIsSubmitted(true);
      setLastComplaintId(`CMP-${Date.now().toString().slice(-6)}`);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setComplaintType('');
    setDescription('');
    setLocation('');
    setCoordinates(null);
  };

  if (isSubmitted) {
    return (
      <div className="card-command p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-full bg-risk-safe/20 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-risk-safe" />
          </div>
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          Complaint Registered!
        </h3>
        <p className="text-muted-foreground mb-4">
          Your complaint has been submitted successfully.
        </p>
        <div className="bg-secondary rounded-lg p-4 mb-6">
          <p className="text-sm text-muted-foreground">Complaint ID</p>
          <p className="text-2xl font-mono font-bold text-primary">{lastComplaintId}</p>
        </div>
        <Button onClick={handleReset} variant="outline">
          File Another Complaint
        </Button>
      </div>
    );
  }

  return (
    <div className="card-command p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">File a Complaint</h3>
        <p className="text-sm text-muted-foreground">
          Report an incident or suspicious activity
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="type">Complaint Type</Label>
          <Select value={complaintType} onValueChange={setComplaintType} required>
            <SelectTrigger>
              <SelectValue placeholder="Select complaint type" />
            </SelectTrigger>
            <SelectContent>
              {complaintTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the incident in detail..."
            className="min-h-[120px] bg-secondary/50"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <div className="flex gap-2">
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter location or use GPS"
              className="bg-secondary/50"
              required
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleGetLocation}
              disabled={isGettingLocation}
            >
              {isGettingLocation ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
            </Button>
          </div>
          {coordinates && (
            <p className="text-xs text-muted-foreground">
              📍 Coordinates captured: {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date of Incident</Label>
            <Input
              id="date"
              type="date"
              className="bg-secondary/50"
              defaultValue={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="time">Time of Incident</Label>
            <Input id="time" type="time" className="bg-secondary/50" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact">Contact Number</Label>
          <Input
            id="contact"
            type="tel"
            placeholder="+91 XXXXX XXXXX"
            className="bg-secondary/50"
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Submit Complaint
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
