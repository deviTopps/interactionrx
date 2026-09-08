-- User-submitted herb variants with photos
-- Run in Supabase SQL Editor after herbal-import.sql

ALTER TABLE imported_herbs
  ADD COLUMN IF NOT EXISTS variant_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_file_name TEXT,
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE canonical_herbs
  ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE INDEX IF NOT EXISTS idx_imported_herbs_submitted_by
  ON imported_herbs(submitted_by);

-- Storage bucket for herb photos
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('herb-images', 'herb-images', true, 10485760)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "Authenticated can upload herb images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view herb images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own herb images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own herb images" ON storage.objects;

CREATE POLICY "Authenticated can upload herb images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'herb-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Authenticated can view herb images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'herb-images');

CREATE POLICY "Users can update own herb images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'herb-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own herb images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'herb-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
