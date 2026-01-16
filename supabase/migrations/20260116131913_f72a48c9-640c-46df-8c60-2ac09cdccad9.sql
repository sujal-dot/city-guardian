-- Drop the existing SELECT policy that allows all authenticated users to view all incidents
DROP POLICY IF EXISTS "Authenticated users can view incidents" ON public.incidents;

-- Create policy for citizens to view only their own reported incidents
CREATE POLICY "Users can view their own incidents"
ON public.incidents
FOR SELECT
USING (auth.uid() = reported_by);

-- Create policy for police and admins to view all incidents
CREATE POLICY "Police and admins can view all incidents"
ON public.incidents
FOR SELECT
USING (has_role(auth.uid(), 'police') OR has_role(auth.uid(), 'admin'));