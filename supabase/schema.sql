-- InteractionRX Database Schema
-- Run this in your Supabase SQL Editor

-- Herbal Medicines table
CREATE TABLE IF NOT EXISTS herbal_medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  description_file_url TEXT,
  description_file_name TEXT,
  composition TEXT,
  composition_file_url TEXT,
  composition_file_name TEXT,
  origin VARCHAR(255) DEFAULT 'Local',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ingredients used in each medicine
CREATE TABLE IF NOT EXISTS medicine_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID NOT NULL REFERENCES herbal_medicines(id) ON DELETE CASCADE,
  ingredient_name VARCHAR(255) NOT NULL,
  quantity VARCHAR(100),
  unit VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_herbal_medicines_created_by ON herbal_medicines(created_by);
CREATE INDEX IF NOT EXISTS idx_medicine_ingredients_medicine_id ON medicine_ingredients(medicine_id);

-- Row Level Security
ALTER TABLE herbal_medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_ingredients ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all medicines
CREATE POLICY "Users can view herbal medicines"
  ON herbal_medicines FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert their own medicines
CREATE POLICY "Users can create herbal medicines"
  ON herbal_medicines FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Users can update their own medicines
CREATE POLICY "Users can update own herbal medicines"
  ON herbal_medicines FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

-- Users can delete their own medicines
CREATE POLICY "Users can delete own herbal medicines"
  ON herbal_medicines FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Ingredients policies (via medicine ownership)
CREATE POLICY "Users can view ingredients"
  ON medicine_ingredients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM herbal_medicines
      WHERE herbal_medicines.id = medicine_ingredients.medicine_id
    )
  );

CREATE POLICY "Users can insert ingredients"
  ON medicine_ingredients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM herbal_medicines
      WHERE herbal_medicines.id = medicine_ingredients.medicine_id
      AND herbal_medicines.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update ingredients"
  ON medicine_ingredients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM herbal_medicines
      WHERE herbal_medicines.id = medicine_ingredients.medicine_id
      AND herbal_medicines.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete ingredients"
  ON medicine_ingredients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM herbal_medicines
      WHERE herbal_medicines.id = medicine_ingredients.medicine_id
      AND herbal_medicines.created_by = auth.uid()
    )
  );

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER herbal_medicines_updated_at
  BEFORE UPDATE ON herbal_medicines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
