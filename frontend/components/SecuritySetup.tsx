'use client';

import { useState } from 'react';
import { SquareLock01Icon } from '@hugeicons/core-free-icons';
import Icon from './Icon';

const SQL_EDITOR_URL =
  'https://supabase.com/dashboard/project/blyolwakndjnyhmorwrb/sql/new';

interface SecuritySetupProps {
  onComplete?: () => void;
  variant?: 'full' | 'profile' | 'policy';
}

export default function SecuritySetup({ onComplete, variant = 'profile' }: SecuritySetupProps) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [copying, setCopying] = useState(false);

  const fetchSql = async () => {
    const endpoint =
      variant === 'full'
        ? '/api/setup/security-sql'
        : variant === 'policy'
          ? '/api/setup/security-policy-fix-sql'
          : '/api/setup/profile-fix-sql';
    const res = await fetch(endpoint);
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
      alert('Could not copy SQL. Make sure the backend is running.');
    } finally {
      setCopying(false);
    }
  };

  const checkAgain = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/setup/status');
      const data = await res.json();
      if (data.ready) {
        onComplete?.();
        window.location.reload();
      } else if (data.needsSecuritySetup) {
        alert('Security tables not found yet. Run supabase/security.sql in Supabase, then try again.');
      } else {
        alert('Setup not complete yet. Run the SQL in Supabase, then try again.');
      }
    } catch {
      alert('Could not reach the API. Make sure the backend is running.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="card border-red-200 bg-red-50">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center text-red-700">
          <Icon icon={SquareLock01Icon} size={24} />
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-red-900">Security setup required</h2>
          <p className="mt-1 text-sm text-red-800">
            {variant === 'full'
              ? 'Security tables (user profiles, audit logs) are not installed yet. Copy and run the SQL below in Supabase.'
              : variant === 'policy'
                ? 'A database policy error was detected (infinite recursion). Copy and run the fix SQL below in Supabase.'
                : 'Your account has no user profile. Copy and run the SQL below to enable access.'}
          </p>

          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-red-900">
            <li>Click <strong>Open SQL Editor</strong></li>
            <li>Click <strong>Copy SQL</strong> and paste into the editor</li>
            <li>Click <strong>Run</strong> in Supabase</li>
            <li>Return here and click <strong>Check again</strong></li>
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
            <button onClick={copySql} disabled={copying} className="btn-secondary">
              {copied ? 'Copied!' : copying ? 'Loading...' : 'Copy SQL'}
              {!copied && !copying ? <kbd className="btn-shortcut">⌘C</kbd> : null}
            </button>
            <button onClick={checkAgain} disabled={checking} className="btn-primary">
              {checking ? 'Checking...' : 'Run fix'}
              {!checking ? <kbd className="btn-shortcut">⌘↵</kbd> : null}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
