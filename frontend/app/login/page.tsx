'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';
import Logo from '@/components/Logo';
import Icon from '@/components/Icon';
import { ShieldCheckIcon } from '@hugeicons/core-free-icons';

const LoginBackground = dynamic(() => import('@/components/LoginBackground'), {
  ssr: false,
});

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const timeout = searchParams.get('reason') === 'timeout';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <LoginBackground />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="card flex w-full max-w-sm min-h-[24rem] flex-col justify-center py-8 shadow-2xl">
          <div className="mb-6 flex flex-col items-center text-center">
            <Logo size="lg" href="" />
            <p className="mt-3 text-base text-gray-600">
              AI System for Herbal Medicine Interactions
            </p>
          </div>

          {timeout && (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Your session expired due to inactivity. Please sign in again.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@organization.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary !h-10 w-full rounded-md">
              {loading ? 'Signing in...' : 'Sign in'}
              {!loading ? <kbd className="btn-shortcut">⌘↵</kbd> : null}
            </button>

            <p className="flex items-center justify-center gap-1.5 pt-2 text-sm text-gray-500">
              <Icon icon={ShieldCheckIcon} size={14} className="shrink-0 text-gray-400" />
              Powered By Data Leap Technologies LLC.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#000C38] text-white">
          Loading...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
