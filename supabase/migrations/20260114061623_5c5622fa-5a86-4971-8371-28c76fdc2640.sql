-- Create enum for complaint status
CREATE TYPE public.complaint_status AS ENUM ('pending', 'in_progress', 'resolved', 'closed');

-- Create enum for incident severity
CREATE TYPE public.incident_severity AS ENUM ('low', 'medium', 'high', 'critical');

-- Create enum for incident status
CREATE TYPE public.incident_status AS ENUM ('reported', 'investigating', 'resolved', 'closed');

-- Create complaints table
CREATE TABLE public.complaints (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    complaint_type TEXT NOT NULL,
    description TEXT NOT NULL,
    location_name TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    status complaint_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create incidents table
CREATE TABLE public.incidents (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    incident_type TEXT NOT NULL,
    severity incident_severity NOT NULL DEFAULT 'medium',
    status incident_status NOT NULL DEFAULT 'reported',
    location_name TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_officer TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create crime_data table for historical crime statistics
CREATE TABLE public.crime_data (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    zone_name TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    crime_type TEXT NOT NULL,
    risk_score INTEGER NOT NULL DEFAULT 50 CHECK (risk_score >= 0 AND risk_score <= 100),
    incident_count INTEGER NOT NULL DEFAULT 0,
    recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create high_risk_zones table for geofencing
CREATE TABLE public.high_risk_zones (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    zone_name TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 500,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('medium', 'high', 'critical')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_locations table for tracking citizen locations (opt-in)
CREATE TABLE public.user_locations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(10, 2),
    is_tracking_enabled BOOLEAN NOT NULL DEFAULT false,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

-- Create SOS alerts table
CREATE TABLE public.sos_alerts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'responding', 'resolved')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crime_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.high_risk_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;

-- Complaints policies
CREATE POLICY "Users can view their own complaints" 
ON public.complaints FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create complaints" 
ON public.complaints FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can create complaints without login" 
ON public.complaints FOR INSERT 
WITH CHECK (user_id IS NULL);

-- Incidents policies (public read for citizens to see nearby incidents)
CREATE POLICY "Anyone can view incidents" 
ON public.incidents FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create incidents" 
ON public.incidents FOR INSERT 
WITH CHECK (auth.uid() = reported_by);

-- Crime data policies (public read for heatmap visualization)
CREATE POLICY "Anyone can view crime data" 
ON public.crime_data FOR SELECT 
USING (true);

-- High risk zones policies (public read for geofencing alerts)
CREATE POLICY "Anyone can view high risk zones" 
ON public.high_risk_zones FOR SELECT 
USING (true);

-- User locations policies
CREATE POLICY "Users can view their own location" 
ON public.user_locations FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own location" 
ON public.user_locations FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own location" 
ON public.user_locations FOR UPDATE 
USING (auth.uid() = user_id);

-- SOS alerts policies
CREATE POLICY "Users can view their own SOS alerts" 
ON public.sos_alerts FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create SOS alerts" 
ON public.sos_alerts FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can create SOS alerts without login" 
ON public.sos_alerts FOR INSERT 
WITH CHECK (user_id IS NULL);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_complaints_updated_at
BEFORE UPDATE ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at
BEFORE UPDATE ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_high_risk_zones_updated_at
BEFORE UPDATE ON public.high_risk_zones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.high_risk_zones;

-- Insert initial high-risk zones for Thane city
INSERT INTO public.high_risk_zones (zone_name, latitude, longitude, radius_meters, risk_level) VALUES
('Mumbra Station Area', 19.1726, 73.0294, 500, 'critical'),
('Thane Station Area', 19.1860, 72.9750, 400, 'high'),
('Kalwa Industrial Zone', 19.2000, 72.9950, 450, 'high'),
('Naupada Market', 19.1950, 72.9650, 300, 'medium'),
('Kopri Junction', 19.1800, 72.9600, 350, 'medium');

-- Insert initial crime data for Thane city
INSERT INTO public.crime_data (zone_name, latitude, longitude, crime_type, risk_score, incident_count) VALUES
('Mumbra', 19.1726, 73.0294, 'Theft', 85, 45),
('Thane Station', 19.1860, 72.9750, 'Assault', 72, 32),
('Kalwa', 19.2000, 72.9950, 'Robbery', 68, 28),
('Naupada', 19.1950, 72.9650, 'Burglary', 55, 18),
('Kopri', 19.1800, 72.9600, 'Vandalism', 45, 12);