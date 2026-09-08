-- InteractionRX: Drug-to-Drug Interactions
-- Run in Supabase SQL Editor after security.sql
--
-- Creates the drug catalog (seeded from the NHIS Medicines List 2025) and the
-- pairwise drug-drug interaction knowledge base used by the Interactions
-- checker. Catalog and rule content are loaded from the API after this runs.

-- ---------------------------------------------------------------------------
-- Drug catalog (active-ingredient level — one row per prescribable substance)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_key TEXT NOT NULL,
  generic_name TEXT NOT NULL,
  drug_class TEXT,
  atc_code TEXT,
  nhis_code TEXT,
  dosage_forms TEXT[] NOT NULL DEFAULT '{}',
  prescribing_level TEXT,
  is_high_alert BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'NHIS Medicines List 2025',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS drugs_ingredient_key_idx ON drugs (ingredient_key);
CREATE INDEX IF NOT EXISTS drugs_generic_name_lower_idx ON drugs (LOWER(generic_name));
CREATE INDEX IF NOT EXISTS drugs_drug_class_idx ON drugs (drug_class);

-- ---------------------------------------------------------------------------
-- Therapeutic / pharmacologic classes
--
-- Interaction rules are authored against either a single ingredient or a whole
-- class, so one rule (e.g. warfarin x NSAID) covers every member of the class.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drug_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS drug_classes_class_key_idx ON drug_classes (class_key);

CREATE TABLE IF NOT EXISTS drug_class_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
  class_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (drug_id, class_key)
);

CREATE INDEX IF NOT EXISTS drug_class_members_drug_id_idx ON drug_class_members (drug_id);
CREATE INDEX IF NOT EXISTS drug_class_members_class_key_idx ON drug_class_members (class_key);

-- ---------------------------------------------------------------------------
-- Pairwise interaction rules
--
-- subject_key / object_key hold either a drugs.ingredient_key or a
-- drug_classes.class_key. Rules are symmetric: the checker matches a pair in
-- both directions, so each clinical interaction is stored once.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drug_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  subject_kind TEXT NOT NULL DEFAULT 'drug'
    CHECK (subject_kind IN ('drug', 'class')),
  object_key TEXT NOT NULL,
  object_kind TEXT NOT NULL DEFAULT 'drug'
    CHECK (object_kind IN ('drug', 'class')),
  severity TEXT NOT NULL
    CHECK (severity IN ('contraindicated', 'major', 'moderate', 'minor', 'unknown')),
  -- A CHECK expression evaluating to NULL passes, so these stay optional
  -- while still rejecting values outside the vocabulary.
  interaction_type TEXT
    CHECK (interaction_type IN ('pharmacokinetic', 'pharmacodynamic', 'duplicate_therapy', 'mixed')),
  onset TEXT CHECK (onset IN ('rapid', 'delayed', 'unspecified')),
  documentation TEXT
    CHECK (documentation IN ('excellent', 'good', 'fair', 'theoretical')),
  summary TEXT NOT NULL,
  mechanism TEXT,
  clinical_effect TEXT,
  management TEXT,
  monitoring TEXT,
  evidence_refs JSONB NOT NULL DEFAULT '[]',
  review_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS drug_interactions_rule_key_idx
  ON drug_interactions (rule_key);
CREATE INDEX IF NOT EXISTS drug_interactions_subject_idx
  ON drug_interactions (subject_key);
CREATE INDEX IF NOT EXISTS drug_interactions_object_idx
  ON drug_interactions (object_key);
CREATE INDEX IF NOT EXISTS drug_interactions_severity_idx
  ON drug_interactions (severity);

-- ---------------------------------------------------------------------------
-- Saved interaction reports (one row per check the user runs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interaction_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL,
  drug_keys TEXT[] NOT NULL,
  drug_names TEXT[] NOT NULL,
  highest_severity TEXT NOT NULL
    CHECK (highest_severity IN ('contraindicated', 'major', 'moderate', 'minor', 'none')),
  finding_count INTEGER NOT NULL DEFAULT 0,
  report JSONB NOT NULL,
  patient_context JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS interaction_checks_reference_idx
  ON interaction_checks (reference);
CREATE INDEX IF NOT EXISTS interaction_checks_created_by_idx
  ON interaction_checks (created_by);
CREATE INDEX IF NOT EXISTS interaction_checks_created_at_idx
  ON interaction_checks (created_at DESC);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Reference data (drugs, classes, rules) is readable by any signed-in user so
-- the checker works for every role. Writes are restricted to staff. Saved
-- reports are private to their author, with staff able to review all of them.
-- ---------------------------------------------------------------------------
ALTER TABLE drugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE drug_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE drug_class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE drug_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in users read drugs" ON drugs;
CREATE POLICY "Signed-in users read drugs"
  ON drugs FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Staff manage drugs" ON drugs;
CREATE POLICY "Staff manage drugs"
  ON drugs FOR ALL TO authenticated
  USING ((SELECT public.is_staff()) OR (SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_staff()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Signed-in users read drug classes" ON drug_classes;
CREATE POLICY "Signed-in users read drug classes"
  ON drug_classes FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Staff manage drug classes" ON drug_classes;
CREATE POLICY "Staff manage drug classes"
  ON drug_classes FOR ALL TO authenticated
  USING ((SELECT public.is_staff()) OR (SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_staff()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Signed-in users read class members" ON drug_class_members;
CREATE POLICY "Signed-in users read class members"
  ON drug_class_members FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Staff manage class members" ON drug_class_members;
CREATE POLICY "Staff manage class members"
  ON drug_class_members FOR ALL TO authenticated
  USING ((SELECT public.is_staff()) OR (SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_staff()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Signed-in users read approved interactions" ON drug_interactions;
CREATE POLICY "Signed-in users read approved interactions"
  ON drug_interactions FOR SELECT TO authenticated
  USING (
    review_status = 'approved'
    OR (SELECT public.is_staff())
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "Staff manage interactions" ON drug_interactions;
CREATE POLICY "Staff manage interactions"
  ON drug_interactions FOR ALL TO authenticated
  USING ((SELECT public.is_staff()) OR (SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_staff()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Users read own interaction checks" ON interaction_checks;
CREATE POLICY "Users read own interaction checks"
  ON interaction_checks FOR SELECT TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR (SELECT public.is_staff())
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "Users create own interaction checks" ON interaction_checks;
CREATE POLICY "Users create own interaction checks"
  ON interaction_checks FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users delete own interaction checks" ON interaction_checks;
CREATE POLICY "Users delete own interaction checks"
  ON interaction_checks FOR DELETE TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS drugs_updated_at ON drugs;
CREATE TRIGGER drugs_updated_at
  BEFORE UPDATE ON drugs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS drug_interactions_updated_at ON drug_interactions;
CREATE TRIGGER drug_interactions_updated_at
  BEFORE UPDATE ON drug_interactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- After running this file, load the NHIS drug catalog and interaction rules
-- from the app: Interactions page -> "Load drug catalog" (admin or officer).
