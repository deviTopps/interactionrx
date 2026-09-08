'use client';

import { useState } from 'react';

const API_SETTINGS_URL =
  'https://supabase.com/dashboard/project/blyolwakndjnyhmorwrb/settings/api';

export default function UserManagementSetup({ onComplete }: { onComplete?: () => void }) {
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const checkAgain = async () => {
    setChecking(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/setup/user-management-status');
      const data = await res.json();
      if (data.configured) {
        onComplete?.();
        return;
      }
      setStatusMessage(data.message || 'Service role key is still not configured.');
    } catch {
      setStatusMessage('Could not reach the backend. Make sure it is running on port 4000.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="card border-amber-200 bg-amber-50">
      <h2 className="text-lg font-semibold text-amber-900">Service role key required</h2>
      <p className="mt-1 text-sm text-amber-800">
        <code className="rounded bg-amber-100 px-1">backend/.env</code> line{' '}
        <code className="rounded bg-amber-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code> is empty.
        User management needs your Supabase <strong>secret</strong> key on the server only.
      </p>

      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-amber-900">
        <li>
          Open{' '}
          <a href={API_SETTINGS_URL} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            Supabase → Project Settings → API
          </a>
          .
        </li>
        <li>
          Find <strong>Secret keys</strong> (or legacy <strong>service_role</strong>) and click{' '}
          <strong>Reveal</strong>.
        </li>
        <li>
          Copy the <strong>whole</strong> value — it is one long string, often starting with{' '}
          <code className="rounded bg-amber-100 px-1">sb_secret_</code> or{' '}
          <code className="rounded bg-amber-100 px-1">eyJ</code>.
        </li>
        <li>
          In <code className="rounded bg-amber-100 px-1">backend/.env</code>, set:
          <pre className="mt-2 overflow-x-auto rounded-md bg-amber-100/80 p-3 text-xs text-amber-950">
            SUPABASE_SERVICE_ROLE_KEY=
          </pre>
          Paste your key <strong>immediately after the =</strong> with no spaces or quotes.
        </li>
        <li>Save the file and restart the backend.</li>
      </ol>

      <p className="mt-3 text-xs text-amber-800">
        Do not paste example text, the project URL, or the publishable key from the frontend.
      </p>

      {statusMessage && (
        <p className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">{statusMessage}</p>
      )}

      <div className="btn-toolbar mt-4">
        <a href={API_SETTINGS_URL} target="_blank" rel="noopener noreferrer" className="btn-primary">
          Open Supabase API settings
        </a>
        <button type="button" onClick={checkAgain} disabled={checking} className="btn-secondary">
          {checking ? 'Checking...' : 'Check again'}
        </button>
      </div>
    </div>
  );
}
