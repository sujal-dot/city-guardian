-- Track who reported an incident so admins can distinguish citizen reports.
ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS incident_source text NOT NULL DEFAULT 'police'
CHECK (incident_source IN ('citizen', 'police', 'admin', 'system'));

CREATE INDEX IF NOT EXISTS incidents_incident_source_idx
ON public.incidents (incident_source);

CREATE OR REPLACE FUNCTION public.assign_incident_source_from_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reported_by IS NULL THEN
    NEW.incident_source := COALESCE(NEW.incident_source, 'system');
    RETURN NEW;
  END IF;

  IF public.has_role(NEW.reported_by, 'admin') THEN
    NEW.incident_source := 'admin';
  ELSIF public.has_role(NEW.reported_by, 'police') THEN
    NEW.incident_source := 'police';
  ELSIF public.has_role(NEW.reported_by, 'citizen') THEN
    NEW.incident_source := 'citizen';
  ELSE
    NEW.incident_source := COALESCE(NEW.incident_source, 'citizen');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_incident_source_before_insert ON public.incidents;
CREATE TRIGGER set_incident_source_before_insert
BEFORE INSERT OR UPDATE OF reported_by ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.assign_incident_source_from_user();

UPDATE public.incidents
SET incident_source = CASE
  WHEN reported_by IS NULL THEN 'system'
  WHEN public.has_role(reported_by, 'admin') THEN 'admin'
  WHEN public.has_role(reported_by, 'police') THEN 'police'
  WHEN public.has_role(reported_by, 'citizen') THEN 'citizen'
  ELSE 'police'
END
WHERE incident_source IS NULL
   OR incident_source NOT IN ('citizen', 'police', 'admin', 'system');
