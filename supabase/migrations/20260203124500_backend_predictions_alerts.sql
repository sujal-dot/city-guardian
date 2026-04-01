-- Tables for server-generated predictions and alerts

CREATE TABLE IF NOT EXISTS public.crime_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_type text NOT NULL CHECK (prediction_type IN ('hotspot', 'trend', 'risk', 'patrol')),
  target_area text,
  data_points integer NOT NULL DEFAULT 0,
  model text,
  prediction jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crime_predictions_created_at_idx ON public.crime_predictions (created_at DESC);

CREATE TABLE IF NOT EXISTS public.crime_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid UNIQUE REFERENCES public.incidents(id) ON DELETE SET NULL,
  incident_title text NOT NULL,
  incident_type text NOT NULL,
  severity public.incident_severity NOT NULL,
  location_name text NOT NULL,
  latitude decimal(10, 8) NOT NULL,
  longitude decimal(11, 8) NOT NULL,
  matched_zone text NOT NULL,
  matched_risk_score integer NOT NULL DEFAULT 0,
  matched_distance_meters integer NOT NULL DEFAULT 0,
  matched_radius_meters integer NOT NULL DEFAULT 0,
  source text NOT NULL CHECK (source IN ('prediction', 'geofence')),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crime_alerts_created_at_idx ON public.crime_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS crime_alerts_incident_id_idx ON public.crime_alerts (incident_id);

ALTER TABLE public.crime_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crime_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Police and admins can view predictions"
ON public.crime_predictions FOR SELECT
USING (
  public.has_role(auth.uid(), 'police') OR
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can manage predictions"
ON public.crime_predictions FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Police and admins can view alerts"
ON public.crime_alerts FOR SELECT
USING (
  public.has_role(auth.uid(), 'police') OR
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Police and admins can update alerts"
ON public.crime_alerts FOR UPDATE
USING (
  public.has_role(auth.uid(), 'police') OR
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Police and admins can delete alerts"
ON public.crime_alerts FOR DELETE
USING (
  public.has_role(auth.uid(), 'police') OR
  public.has_role(auth.uid(), 'admin')
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.crime_alerts;
