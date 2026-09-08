'use client';

import { useState } from 'react';

const SQL_EDITOR_URL =
  'https://supabase.com/dashboard/project/blyolwakndjnyhmorwrb/sql/new';

export default function HerbalImportSetup({ onComplete }: { onComplete?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  const copySql = async () => {
    try {
      const res = await fetch('/api/setup/herbal-import-sql');
      const sql = await res.text();
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('Could not copy SQL. Make sure the backend is running.');
    }
  };

  const checkAgain = async () => {
    setChecking(true);
    try {
      const { api } = await import('@/lib/api');
      await api.getImportedHerbs('pending');
      onComplete?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('Import tables not installed')) {
        alert('Import tables not found yet. Run the SQL in Supabase, then try again.');
      } else {
        alert('Could not reach the API. Make sure the backend is running.');
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="card border-amber-200 bg-amber-50">
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-amber-900">Herb discovery tables required</h2>
        <p className="mt-1 text-sm text-amber-800">
          Run <code className="rounded bg-amber-100 px-1">supabase/herbal-import.sql</code> once
          in Supabase to enable online herb scraping. For user photo submissions, also run{' '}
          <code className="rounded bg-amber-100 px-1">supabase/herb-submissions.sql</code>.
        </p>
        <div className="btn-toolbar mt-4">
          <a href={SQL_EDITOR_URL} target="_blank" rel="noopener noreferrer" className="btn-primary">
            Open SQL Editor
          </a>
          <button type="button" onClick={copySql} className="btn-secondary">
            {copied ? 'Copied!' : 'Copy SQL'}
          </button>
          <button type="button" onClick={checkAgain} disabled={checking} className="btn-secondary">
            {checking ? 'Checking...' : 'Check again'}
          </button>
        </div>
      </div>
    </div>
  );
}
