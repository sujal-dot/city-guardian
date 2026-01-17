-- Create audit_log table to track privileged modifications
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs"
ON public.audit_log FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Create audit logging function
CREATE OR REPLACE FUNCTION public.log_privileged_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD), NULL);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add audit triggers to sensitive tables
CREATE TRIGGER audit_complaints_changes
AFTER UPDATE OR DELETE ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.log_privileged_changes();

CREATE TRIGGER audit_sos_alerts_changes
AFTER UPDATE OR DELETE ON public.sos_alerts
FOR EACH ROW
EXECUTE FUNCTION public.log_privileged_changes();

CREATE TRIGGER audit_incidents_changes
AFTER UPDATE OR DELETE ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.log_privileged_changes();

-- Add columns for IP tracking on anonymous submissions
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS submitted_from_ip text;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS submitted_from_ip text;

-- Add needs_review column for anonymous submissions
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false;
ALTER TABLE public.sos_alerts ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false;

-- Create function to mark anonymous submissions for review
CREATE OR REPLACE FUNCTION public.mark_anonymous_for_review()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.needs_review := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for complaints
CREATE TRIGGER mark_anonymous_complaints_for_review
BEFORE INSERT ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.mark_anonymous_for_review();

-- Trigger for sos_alerts
CREATE TRIGGER mark_anonymous_sos_for_review
BEFORE INSERT ON public.sos_alerts
FOR EACH ROW
EXECUTE FUNCTION public.mark_anonymous_for_review();