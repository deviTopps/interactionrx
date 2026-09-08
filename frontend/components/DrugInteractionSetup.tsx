'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

const SQL_EDITOR_URL =
  'https://supabase.com/dashboard/project/blyolwakndjnyhmorwrb/sql/new';

type Variant = 'tables' | 'catalog';

export default function DrugInteractionSetup({
  variant,
  bundleSize,
  canSeed,
  onComplete,
}: {
  variant: Variant;
  bundleSize?: { drugs: number; rules: number };
  canSeed?: boolean;
  onComplete?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const copySql = async () => {
    setError('');
    try {
      const res = await fetch('/api/setup/drug-interactions-sql');
      const sql = await res.text();
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy the SQL. Make sure the backend is running.');
    }
  };

  const loadCatalog = async () => {
    setWorking(true);
    setError('');
    try {
      await api.syncDrugCatalog();
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the drug catalog.');
    } finally {
      setWorking(false);
    }
  };

  if (variant === 'catalog') {
    return (
      <div className="card border-amber-200 bg-amber-50">
        <h2 className="text-lg font-semibold text-amber-900">Drug catalog not loaded yet</h2>
        <p className="mt-1 text-sm leading-relaxed text-amber-800">
          The interaction checker needs the NHIS Medicines List 2025 catalog and the interaction
          knowledge base. Loading brings in {bundleSize?.drugs ?? 0} medicines and{' '}
          {bundleSize?.rules ?? 0} interaction monographs. Running it again later is safe — it
          updates existing entries rather than duplicating them.
        </p>
        {canSeed ? (
          <div className="btn-toolbar mt-4">
            <button type="button" onClick={loadCatalog} disabled={working} className="btn-primary">
              {working ? 'Loading catalog...' : 'Load drug catalog'}
            </button>
          </div>
        ) : (
          <p className="mt-4 text-sm font-medium text-amber-900">
            Ask an admin, officer or researcher to load the catalog from this page.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="card border-amber-200 bg-amber-50">
      <h2 className="text-lg font-semibold text-amber-900">Interaction tables required</h2>
      <p className="mt-1 text-sm leading-relaxed text-amber-800">
        Run <code className="rounded bg-amber-100 px-1">supabase/drug-interactions.sql</code> once
        in Supabase to create the drug catalog and interaction knowledge base. You can then load
        the NHIS medicines list from this page.
      </p>
      <div className="btn-toolbar mt-4">
        <a href={SQL_EDITOR_URL} target="_blank" rel="noopener noreferrer" className="btn-primary">
          Open SQL Editor
        </a>
        <button type="button" onClick={copySql} className="btn-secondary">
          {copied ? 'Copied!' : 'Copy SQL'}
        </button>
        <button type="button" onClick={() => onComplete?.()} className="btn-secondary">
          Check again
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
