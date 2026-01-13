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
import { useToast } from '@/hooks/use-toast';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [location, setLocation] = useState('');
  const { toast } = useToast();

  const handleGetLocation = async () => {
    setIsGettingLocation(true);
    
    // Simulate location detection
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setLocation('Thane Station Area, Thane West, Maharashtra 400601');
    setIsGettingLocation(false);
    
    toast({
      title: "Location detected",
      description: "Your current location has been captured.",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setIsSubmitting(false);
    setIsSubmitted(true);

    toast({
      title: "Complaint Registered Successfully!",
      description: "Your complaint ID is CMP-2024-007. Track it in 'My Complaints'.",
    });
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
          <p className="text-2xl font-mono font-bold text-primary">CMP-2024-007</p>
        </div>
        <Button onClick={() => setIsSubmitted(false)} variant="outline">
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
          <Select required>
            <SelectTrigger>
              <SelectValue placeholder="Select complaint type" />
            </SelectTrigger>
            <SelectContent>
              {complaintTypes.map((type) => (
                <SelectItem key={type} value={type.toLowerCase().replace(/ /g, '-')}>
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
            <Input
              id="time"
              type="time"
              className="bg-secondary/50"
            />
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

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
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
