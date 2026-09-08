-- Move herb records out of herbal_medicines into canonical_herbs (run once in Supabase SQL Editor)
-- Use this if herbs were previously imported into the medicine registry.

-- 1) Legacy path: imported_herbs still has imported_medicine_id
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
    SET
      canonical_herb_id = ch.id,
      import_status = 'approved'
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

-- 2) Heuristic path: online scrape imports left in herbal_medicines
INSERT INTO canonical_herbs (canonical_name, latin_name, description)
SELECT DISTINCT ON (LOWER(hm.name))
  hm.name,
  NULLIF(TRIM(hm.composition), ''),
  NULLIF(TRIM(hm.description), '')
FROM herbal_medicines hm
WHERE hm.origin = 'Online'
  AND (
    hm.description ILIKE '%Imported from%'
    OR hm.description ILIKE '%Discovered from%'
    OR hm.composition ILIKE '%Composition to be verified%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM canonical_herbs ch
    WHERE LOWER(ch.canonical_name) = LOWER(hm.name)
  );

UPDATE imported_herbs ih
SET
  canonical_herb_id = ch.id,
  import_status = 'approved'
FROM canonical_herbs ch
WHERE ih.canonical_herb_id IS NULL
  AND LOWER(ch.canonical_name) = LOWER(ih.name);

DELETE FROM herbal_medicines hm
WHERE hm.origin = 'Online'
  AND (
    hm.description ILIKE '%Imported from%'
    OR hm.description ILIKE '%Discovered from%'
    OR hm.composition ILIKE '%Composition to be verified%'
  )
  AND EXISTS (
    SELECT 1 FROM canonical_herbs ch
    WHERE LOWER(ch.canonical_name) = LOWER(hm.name)
  );
