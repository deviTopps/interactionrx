-- Medicine document uploads (description & composition files)
-- Run in Supabase SQL Editor after schema.sql

ALTER TABLE herbal_medicines
  ADD COLUMN IF NOT EXISTS description_file_url TEXT,
  ADD COLUMN IF NOT EXISTS description_file_name TEXT,
  ADD COLUMN IF NOT EXISTS composition_file_url TEXT,
  ADD COLUMN IF NOT EXISTS composition_file_name TEXT;

ALTER TABLE herbal_medicines ALTER COLUMN composition DROP NOT NULL;

-- Storage bucket for medicine documents
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('medicine-documents', 'medicine-documents', true, 10485760)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "Authenticated can upload medicine documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view medicine documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own medicine documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own medicine documents" ON storage.objects;

CREATE POLICY "Authenticated can upload medicine documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'medicine-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Authenticated can view medicine documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'medicine-documents');

CREATE POLICY "Users can update own medicine documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'medicine-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own medicine documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'medicine-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
