-- Expand user roles for InteractionRX
-- Run in Supabase SQL Editor after security.sql
-- Fixes "Database error creating new user" when assigning Collaborator / Researcher roles

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'officer', 'researcher', 'collaborator', 'viewer'));

DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;
CREATE POLICY "Admins can manage all profiles"
  ON user_profiles FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_my_role() IN ('admin', 'officer', 'researcher');
$$;

GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role text;
BEGIN
  assigned_role := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'role'), ''), 'collaborator');
  IF assigned_role NOT IN ('admin', 'officer', 'researcher', 'collaborator', 'viewer') THEN
    assigned_role := 'collaborator';
  END IF;

  INSERT INTO public.user_profiles (user_id, full_name, role, department)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
    assigned_role,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'department'), ''), 'General')
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
