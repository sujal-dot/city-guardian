-- Assign the requested role during signup and remove the duplicate role trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role text;
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (user_id) DO NOTHING;

  requested_role := COALESCE(NEW.raw_user_meta_data->>'requested_role', 'citizen');

  IF requested_role NOT IN ('citizen', 'police', 'admin') THEN
    requested_role := 'citizen';
  END IF;

  assigned_role := requested_role::public.app_role;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_role();
