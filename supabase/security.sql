-- InteractionRX: Security Extension
-- Run AFTER schema.sql in Supabase SQL Editor

-- User roles: admin | officer | viewer
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  role VARCHAR(20) NOT NULL DEFAULT 'officer' CHECK (role IN ('admin', 'officer', 'viewer')),
  department VARCHAR(255) DEFAULT 'General',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Immutable audit trail
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  entity_name VARCHAR(255),
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Role helpers (SECURITY DEFINER avoids RLS recursion on user_profiles)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_profiles
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_my_role() = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_my_role() IN ('admin', 'officer');
$$;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- Profiles: users read own profile; admins read all
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Users can update own profile name"
  ON user_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Audit logs: admins and officers can read
CREATE POLICY "Staff can view audit logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "Authenticated can insert audit logs"
  ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, full_name, role, department)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'officer'),
    'General'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Backfill profiles for existing users
INSERT INTO user_profiles (user_id, full_name, role, department)
SELECT id, split_part(email, '@', 1), 'officer', 'General'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_profiles)
ON CONFLICT (user_id) DO NOTHING;

-- Bootstrap profile for users created before the trigger (callable from API)
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS user_profiles AS $$
DECLARE
  result user_profiles;
  user_email TEXT;
  user_name TEXT;
BEGIN
  SELECT * INTO result FROM user_profiles WHERE user_id = auth.uid();
  IF FOUND THEN
    RETURN result;
  END IF;

  SELECT email, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
  INTO user_email, user_name
  FROM auth.users
  WHERE id = auth.uid();

  INSERT INTO user_profiles (user_id, full_name, role, department)
  VALUES (auth.uid(), user_name, 'officer', 'General')
  RETURNING * INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO authenticated;

CREATE POLICY "Users can create own profile"
  ON user_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Update herbal_medicines RLS for role-based access
DROP POLICY IF EXISTS "Users can create herbal medicines" ON herbal_medicines;
DROP POLICY IF EXISTS "Users can update own herbal medicines" ON herbal_medicines;
DROP POLICY IF EXISTS "Users can delete own herbal medicines" ON herbal_medicines;

CREATE POLICY "Officers can create herbal medicines"
  ON herbal_medicines FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.is_staff());

CREATE POLICY "Officers can update herbal medicines"
  ON herbal_medicines FOR UPDATE TO authenticated
  USING (public.is_staff());

CREATE POLICY "Officers can delete herbal medicines"
  ON herbal_medicines FOR DELETE TO authenticated
  USING (public.is_staff());

-- To promote a user to admin, run:
-- UPDATE user_profiles SET role = 'admin' WHERE user_id = '<user-uuid>';
