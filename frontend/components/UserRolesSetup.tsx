'use client';

import { useState } from 'react';
import { UserMultipleIcon } from '@hugeicons/core-free-icons';
import Icon from './Icon';

const SQL_EDITOR_URL =
  'https://supabase.com/dashboard/project/blyolwakndjnyhmorwrb/sql/new';

export default function UserRolesSetup({ onComplete }: { onComplete?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [copying, setCopying] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const fetchSql = async () => {
    const res = await fetch('/api/setup/user-roles-expansion-sql');
    if (!res.ok) throw new Error('Could not load setup SQL');
    return res.text();
  };

  const copySql = async () => {
    setCopying(true);
    try {
      const sql = await fetchSql();
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setStatusMessage('Could not copy SQL. Make sure the backend is running on port 4000.');
    } finally {
      setCopying(false);
    }
  };

  const checkAgain = async () => {
    setChecking(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/setup/user-roles-status');
      const data = await res.json();
      if (data.applied) {
        onComplete?.();
        return;
      }
      if (data.reason === 'missing_profiles_table') {
        setStatusMessage('user_profiles table not found. Run supabase/security.sql first.');
      } else {
        setStatusMessage('Role expansion not applied yet. Copy the SQL, run it in Supabase, then check again.');
      }
    } catch {
      setStatusMessage('Could not reach the backend. Make sure it is running on port 4000.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="card border-amber-200 bg-amber-50">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center text-amber-800">
          <Icon icon={UserMultipleIcon} size={24} />
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-amber-900">User types setup required</h2>
          <p className="mt-1 text-sm text-amber-800">
            The database only allows legacy roles (<strong>admin</strong>, <strong>officer</strong>,{' '}
            <strong>viewer</strong>). Run a one-time SQL script to enable{' '}
            <strong>Collaborator</strong> and <strong>Researcher</strong> accounts.
          </p>

          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-amber-900">
            <li>Click <strong>Copy SQL</strong></li>
            <li>Click <strong>Open SQL Editor</strong> and paste the script</li>
            <li>Click <strong>Run</strong> in Supabase</li>
            <li>Return here and click <strong>Check again</strong></li>
          </ol>

          {statusMessage && (
            <p className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">{statusMessage}</p>
          )}

          <div className="btn-toolbar mt-5">
            <button type="button" onClick={copySql} disabled={copying} className="btn-secondary">
              {copied ? 'Copied!' : copying ? 'Loading...' : 'Copy SQL'}
            </button>
            <a
              href={SQL_EDITOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              Open SQL Editor
            </a>
            <button type="button" onClick={checkAgain} disabled={checking} className="btn-primary">
              {checking ? 'Checking...' : 'Check again'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
