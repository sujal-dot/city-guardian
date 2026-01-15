-- Step 1: Create the app_role enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('citizen', 'police', 'admin');
  END IF;
END $$;

-- Step 2: Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Step 3: Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 4: Now create the has_role function (after table exists)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = _role
  )
$$;

-- Step 5: Policy for user_roles - users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Step 6: Add SELECT policy for complaints - police/admins can view all
CREATE POLICY "Police and admins can view all complaints"
ON public.complaints
FOR SELECT
USING (
  public.has_role(auth.uid(), 'police') OR 
  public.has_role(auth.uid(), 'admin')
);

-- Step 7: Add UPDATE policy so users can update their own complaints
CREATE POLICY "Users can update their own complaints"
ON public.complaints
FOR UPDATE
USING (auth.uid() = user_id);

-- Step 8: Add DELETE policy so users can delete their own complaints
CREATE POLICY "Users can delete their own complaints"
ON public.complaints
FOR DELETE
USING (auth.uid() = user_id);

-- Step 9: Police/admins can update any complaint
CREATE POLICY "Police and admins can update all complaints"
ON public.complaints
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'police') OR 
  public.has_role(auth.uid(), 'admin')
);