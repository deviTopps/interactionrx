-- Run this in Supabase SQL Editor if you see "User profile not found"
-- Safe to run multiple times

-- Backfill any auth users missing a profile
INSERT INTO user_profiles (user_id, full_name, role, department)
SELECT id, split_part(email, '@', 1), 'officer', 'General'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_profiles)
ON CONFLICT (user_id) DO NOTHING;

-- Auto-create profile on first login (used by the API)
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS user_profiles AS $$
DECLARE
  result user_profiles;
  user_name TEXT;
BEGIN
  SELECT * INTO result FROM user_profiles WHERE user_id = auth.uid();
  IF FOUND THEN
    RETURN result;
  END IF;

  SELECT COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
  INTO user_name
  FROM auth.users
  WHERE id = auth.uid();

  INSERT INTO user_profiles (user_id, full_name, role, department)
  VALUES (auth.uid(), user_name, 'officer', 'General')
  RETURNING * INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_profiles' AND policyname = 'Users can create own profile'
  ) THEN
    CREATE POLICY "Users can create own profile"
      ON user_profiles FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
