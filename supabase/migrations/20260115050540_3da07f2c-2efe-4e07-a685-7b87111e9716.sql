-- Create profiles table for user information
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Police/admins can view all profiles
CREATE POLICY "Police and admins can view all profiles"
ON public.profiles FOR SELECT
USING (
  public.has_role(auth.uid(), 'police') OR 
  public.has_role(auth.uid(), 'admin')
);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  
  -- Assign default citizen role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'citizen');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Fix SOS alerts: Police/admins can view all SOS alerts
CREATE POLICY "Police and admins can view all SOS alerts"
ON public.sos_alerts
FOR SELECT
USING (
  public.has_role(auth.uid(), 'police') OR 
  public.has_role(auth.uid(), 'admin')
);

-- Police/admins can update SOS alerts
CREATE POLICY "Police and admins can update SOS alerts"
ON public.sos_alerts
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'police') OR 
  public.has_role(auth.uid(), 'admin')
);

-- Fix incidents: restrict public access, allow authenticated and role-based access
DROP POLICY IF EXISTS "Anyone can view incidents" ON public.incidents;

-- Authenticated users can view all incidents
CREATE POLICY "Authenticated users can view incidents"
ON public.incidents FOR SELECT
USING (auth.role() = 'authenticated');

-- Police/admins can update any incident
CREATE POLICY "Police and admins can update incidents"
ON public.incidents FOR UPDATE
USING (
  public.has_role(auth.uid(), 'police') OR 
  public.has_role(auth.uid(), 'admin')
);

-- Users can update their own incidents
CREATE POLICY "Users can update their own incidents"
ON public.incidents FOR UPDATE
USING (auth.uid() = reported_by);

-- Users can delete their own incidents
CREATE POLICY "Users can delete their own incidents"
ON public.incidents FOR DELETE
USING (auth.uid() = reported_by);

-- Enable realtime for profiles
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;