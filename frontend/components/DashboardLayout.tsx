'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Sidebar from './Sidebar';
import DashboardFooter from './DashboardFooter';
import SessionTimeout from './SessionTimeout';
import SecuritySetup from './SecuritySetup';

export default function DashboardLayout({
  children,
  title,
  action,
  fullBleed = false,
}: {
  children: React.ReactNode;
  title?: string;
  action?: React.ReactNode;
  /** Drops the page gutter and lets the child stretch to the full content area. */
  fullBleed?: boolean;
}) {
  const { user, permissions, loading, setupError, refreshProfile } = useAuth();
  const router = useRouter();
  const [needsSecuritySetup, setNeedsSecuritySetup] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    fetch('/api/setup/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.needsSecuritySetup) setNeedsSecuritySetup(true);
      })
      .catch(() => {});
  }, [user]);

  const showSecuritySetup =
    needsSecuritySetup ||
    setupError === 'policy_recursion' ||
    (setupError?.includes('Security tables not installed') ?? false);
  const securityVariant = needsSecuritySetup || setupError?.includes('Security tables')
    ? 'full'
    : setupError === 'policy_recursion'
      ? 'policy'
      : 'profile';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <SessionTimeout />
      <Sidebar />

      <div className="ml-56 flex min-h-screen flex-col print:ml-0">
        {(title || action) && (
          <div className="z-20 flex shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-3 print:hidden">
            {title ? (
              <h1 className="text-xl font-semibold tracking-tight text-gray-900">{title}</h1>
            ) : (
              <div />
            )}
            {action ? <div className="btn-toolbar shrink-0">{action}</div> : null}
          </div>
        )}

        <main className="flex min-h-0 flex-1 flex-col overflow-auto">
          <div
            className={`${
              fullBleed ? 'flex min-h-0 flex-1 flex-col' : 'p-6'
            } print:block print:p-0`}
          >
            {(showSecuritySetup || setupError) && (
              <div className={fullBleed ? 'p-6 pb-0' : 'mb-6'}>
                <SecuritySetup
                  variant={securityVariant}
                  onComplete={refreshProfile}
                />
              </div>
            )}
            {children}
          </div>
        </main>
        <DashboardFooter />
      </div>
    </div>
  );
}
