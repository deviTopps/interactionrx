'use client';

import { useState } from 'react';
import { Alert02Icon } from '@hugeicons/core-free-icons';
import Icon from './Icon';

const SETUP_SQL = `-- InteractionRX: run this once in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS herbal_medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  composition TEXT NOT NULL,
  origin VARCHAR(255) DEFAULT 'Local',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medicine_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID NOT NULL REFERENCES herbal_medicines(id) ON DELETE CASCADE,
  ingredient_name VARCHAR(255) NOT NULL,
  quantity VARCHAR(100),
  unit VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_herbal_medicines_created_by ON herbal_medicines(created_by);
CREATE INDEX IF NOT EXISTS idx_medicine_ingredients_medicine_id ON medicine_ingredients(medicine_id);

ALTER TABLE herbal_medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicine_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view herbal medicines" ON herbal_medicines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create herbal medicines" ON herbal_medicines FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own herbal medicines" ON herbal_medicines FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Users can delete own herbal medicines" ON herbal_medicines FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Users can view ingredients" ON medicine_ingredients FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM herbal_medicines WHERE herbal_medicines.id = medicine_ingredients.medicine_id));
CREATE POLICY "Users can insert ingredients" ON medicine_ingredients FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM herbal_medicines WHERE herbal_medicines.id = medicine_ingredients.medicine_id AND herbal_medicines.created_by = auth.uid()));
CREATE POLICY "Users can update ingredients" ON medicine_ingredients FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM herbal_medicines WHERE herbal_medicines.id = medicine_ingredients.medicine_id AND herbal_medicines.created_by = auth.uid()));
CREATE POLICY "Users can delete ingredients" ON medicine_ingredients FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM herbal_medicines WHERE herbal_medicines.id = medicine_ingredients.medicine_id AND herbal_medicines.created_by = auth.uid()));

CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER herbal_medicines_updated_at BEFORE UPDATE ON herbal_medicines FOR EACH ROW EXECUTE FUNCTION update_updated_at();`;

const SQL_EDITOR_URL =
  'https://supabase.com/dashboard/project/blyolwakndjnyhmorwrb/sql/new';

interface DatabaseSetupProps {
  onComplete?: () => void;
}

export default function DatabaseSetup({ onComplete }: DatabaseSetupProps) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  const copySql = async () => {
    await navigator.clipboard.writeText(SETUP_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const checkAgain = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/setup/status');
      const data = await res.json();
      if (data.ready) {
        onComplete?.();
      } else {
        alert('Tables not found yet. Please run the SQL in Supabase first, then try again.');
      }
    } catch {
      alert('Could not reach the API. Make sure the backend is running.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="card border-amber-200 bg-amber-50">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center text-amber-700">
          <Icon icon={Alert02Icon} size={24} />
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-amber-900">Database setup required</h2>
          <p className="mt-1 text-sm text-amber-800">
            The <code className="rounded bg-amber-100 px-1">herbal_medicines</code> table
            does not exist yet. Run the setup SQL once in Supabase.
          </p>

          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-amber-900">
            <li>Click <strong>Open SQL Editor</strong> below</li>
            <li>Click <strong>Copy SQL</strong> and paste it into the editor</li>
            <li>Click <strong>Run</strong> in Supabase</li>
            <li>Come back here and click <strong>Check again</strong></li>
          </ol>

          <div className="btn-toolbar mt-5">
            <a
              href={SQL_EDITOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              Open SQL Editor
            </a>
            <button onClick={copySql} className="btn-secondary">
              {copied ? 'Copied!' : 'Copy SQL'}
              {!copied ? <kbd className="btn-shortcut">⌘C</kbd> : null}
            </button>
            <button onClick={checkAgain} disabled={checking} className="btn-primary">
              {checking ? 'Checking...' : 'Run setup'}
              {!checking ? <kbd className="btn-shortcut">⌘↵</kbd> : null}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
