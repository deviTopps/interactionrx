-- Separate herbs from herbal medicines (run once if herbal-import.sql was already applied)
-- Herbs live in canonical_herbs; herbal_medicines is the product registry only.

ALTER TABLE imported_herbs
  ADD COLUMN IF NOT EXISTS canonical_herb_id UUID REFERENCES canonical_herbs(id) ON DELETE SET NULL;

-- Move any herb rows still linked to herbal_medicines before dropping the column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'imported_herbs' AND column_name = 'imported_medicine_id'
  ) THEN
    INSERT INTO canonical_herbs (canonical_name, latin_name, description, wikidata_id)
    SELECT DISTINCT ON (LOWER(ih.name))
      ih.name,
      ih.latin_name,
      COALESCE(NULLIF(TRIM(ih.description), ''), NULLIF(TRIM(hm.description), '')),
      CASE WHEN ih.source_type = 'wikidata' THEN ih.source_id ELSE NULL END
    FROM imported_herbs ih
    INNER JOIN herbal_medicines hm ON hm.id = ih.imported_medicine_id
    WHERE ih.imported_medicine_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM canonical_herbs ch
        WHERE LOWER(ch.canonical_name) = LOWER(ih.name)
      );

    UPDATE imported_herbs ih
    SET canonical_herb_id = ch.id, import_status = 'approved'
    FROM canonical_herbs ch
    WHERE ih.imported_medicine_id IS NOT NULL
      AND LOWER(ch.canonical_name) = LOWER(ih.name)
      AND ih.canonical_herb_id IS NULL;

    DELETE FROM herbal_medicines hm
    WHERE hm.id IN (
      SELECT imported_medicine_id FROM imported_herbs WHERE imported_medicine_id IS NOT NULL
    );
  END IF;
END $$;

UPDATE imported_herbs
SET import_status = 'approved'
WHERE import_status = 'imported';

ALTER TABLE imported_herbs DROP CONSTRAINT IF EXISTS imported_herbs_import_status_check;
ALTER TABLE imported_herbs
  ADD CONSTRAINT imported_herbs_import_status_check
  CHECK (import_status IN ('pending', 'approved', 'dismissed'));

ALTER TABLE imported_herbs DROP COLUMN IF EXISTS imported_medicine_id;

CREATE INDEX IF NOT EXISTS idx_imported_herbs_canonical
  ON imported_herbs(canonical_herb_id);
