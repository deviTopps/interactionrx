-- InteractionRX: Online herb discovery (staging) + interactions foundation
-- Run in Supabase SQL Editor after schema.sql and security.sql

-- ---------------------------------------------------------------------------
-- Canonical herbs (botanical reference database — separate from herbal_medicines)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS canonical_herbs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  latin_name VARCHAR(255),
  canonical_name VARCHAR(255) NOT NULL,
  description TEXT,
  wikidata_id VARCHAR(32),
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_canonical_herbs_name_lower
  ON canonical_herbs(LOWER(canonical_name));

-- ---------------------------------------------------------------------------
-- Imported herbs (scraped staging — review then approve into canonical_herbs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS imported_herbs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  latin_name VARCHAR(255),
  description TEXT,
  composition TEXT,
  origin VARCHAR(255) DEFAULT 'Online',
  source_type VARCHAR(50) NOT NULL,
  source_id VARCHAR(255) NOT NULL,
  source_url TEXT,
  raw_metadata JSONB DEFAULT '{}',
  import_status VARCHAR(20) DEFAULT 'pending'
    CHECK (import_status IN ('pending', 'approved', 'dismissed')),
  canonical_herb_id UUID REFERENCES canonical_herbs(id) ON DELETE SET NULL,
  variant_name VARCHAR(255),
  image_url TEXT,
  image_file_name TEXT,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_imported_herbs_status ON imported_herbs(import_status);
CREATE INDEX IF NOT EXISTS idx_imported_herbs_name ON imported_herbs(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_imported_herbs_canonical ON imported_herbs(canonical_herb_id);

-- ---------------------------------------------------------------------------
-- Herb aliases & medicine links
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS herb_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_herb_id UUID NOT NULL REFERENCES canonical_herbs(id) ON DELETE CASCADE,
  alias VARCHAR(255) NOT NULL,
  language VARCHAR(32),
  alias_type VARCHAR(32) DEFAULT 'common',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_herb_aliases_unique
  ON herb_aliases(canonical_herb_id, LOWER(alias));

CREATE INDEX IF NOT EXISTS idx_herb_aliases_alias ON herb_aliases(LOWER(alias));

-- Link registry products to canonical herbs
CREATE TABLE IF NOT EXISTS medicine_herb_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID NOT NULL REFERENCES herbal_medicines(id) ON DELETE CASCADE,
  canonical_herb_id UUID NOT NULL REFERENCES canonical_herbs(id) ON DELETE CASCADE,
  confidence NUMERIC(3, 2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (medicine_id, canonical_herb_id)
);

-- ---------------------------------------------------------------------------
-- Herb–drug interactions (evidence-backed)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interaction_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(50) NOT NULL,
  external_id VARCHAR(255),
  title TEXT,
  url TEXT,
  authors TEXT,
  published_at DATE,
  raw_text TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_type, external_id)
);

CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_herb_id UUID REFERENCES canonical_herbs(id) ON DELETE SET NULL,
  herb_name VARCHAR(255) NOT NULL,
  active_compound VARCHAR(255),
  drug_or_class VARCHAR(255) NOT NULL,
  interaction_type VARCHAR(100),
  severity VARCHAR(32) CHECK (severity IN ('mild', 'moderate', 'severe', 'unknown')),
  summary TEXT,
  evidence_quote TEXT,
  review_status VARCHAR(20) DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  confidence NUMERIC(3, 2),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interaction_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id UUID NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES interaction_sources(id) ON DELETE CASCADE,
  quote TEXT,
  page_or_section VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES interaction_sources(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  model VARCHAR(100),
  prompt_version VARCHAR(32),
  result JSONB,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE imported_herbs ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_herbs ENABLE ROW LEVEL SECURITY;
ALTER TABLE herb_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_herb_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read imported herbs"
  ON imported_herbs FOR SELECT TO authenticated
  USING (public.is_staff() OR public.is_admin());

CREATE POLICY "Staff manage imported herbs"
  ON imported_herbs FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_admin())
  WITH CHECK (public.is_staff() OR public.is_admin());

CREATE POLICY "Staff read canonical herbs"
  ON canonical_herbs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Staff manage canonical herbs"
  ON canonical_herbs FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_admin())
  WITH CHECK (public.is_staff() OR public.is_admin());

CREATE POLICY "Staff read herb aliases"
  ON herb_aliases FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Staff manage herb aliases"
  ON herb_aliases FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_admin())
  WITH CHECK (public.is_staff() OR public.is_admin());

CREATE POLICY "Staff read medicine herb links"
  ON medicine_herb_links FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Staff manage medicine herb links"
  ON medicine_herb_links FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_admin())
  WITH CHECK (public.is_staff() OR public.is_admin());

CREATE POLICY "Staff read interaction sources"
  ON interaction_sources FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Staff manage interaction sources"
  ON interaction_sources FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_admin())
  WITH CHECK (public.is_staff() OR public.is_admin());

CREATE POLICY "Staff read interactions"
  ON interactions FOR SELECT TO authenticated
  USING (review_status = 'approved' OR public.is_staff() OR public.is_admin());

CREATE POLICY "Staff manage interactions"
  ON interactions FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_admin())
  WITH CHECK (public.is_staff() OR public.is_admin());

CREATE POLICY "Staff read interaction evidence"
  ON interaction_evidence FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Staff manage interaction evidence"
  ON interaction_evidence FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_admin())
  WITH CHECK (public.is_staff() OR public.is_admin());

CREATE POLICY "Staff read extraction jobs"
  ON extraction_jobs FOR SELECT TO authenticated
  USING (public.is_staff() OR public.is_admin());

CREATE POLICY "Staff manage extraction jobs"
  ON extraction_jobs FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_admin())
  WITH CHECK (public.is_staff() OR public.is_admin());

-- updated_at trigger for imported_herbs
CREATE OR REPLACE FUNCTION update_imported_herbs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS imported_herbs_updated_at ON imported_herbs;
CREATE TRIGGER imported_herbs_updated_at
  BEFORE UPDATE ON imported_herbs
  FOR EACH ROW EXECUTE FUNCTION update_imported_herbs_updated_at();
