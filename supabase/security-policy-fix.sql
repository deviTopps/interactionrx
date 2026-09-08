-- Fix: infinite recursion in user_profiles RLS policies
-- Run this in Supabase SQL Editor if you see "infinite recursion detected in policy"
-- Safe to run multiple times

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

DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Staff can view audit logs" ON audit_logs;
CREATE POLICY "Staff can view audit logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "Officers can create herbal medicines" ON herbal_medicines;
CREATE POLICY "Officers can create herbal medicines"
  ON herbal_medicines FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.is_staff());

DROP POLICY IF EXISTS "Officers can update herbal medicines" ON herbal_medicines;
CREATE POLICY "Officers can update herbal medicines"
  ON herbal_medicines FOR UPDATE TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "Officers can delete herbal medicines" ON herbal_medicines;
CREATE POLICY "Officers can delete herbal medicines"
  ON herbal_medicines FOR DELETE TO authenticated
  USING (public.is_staff());
