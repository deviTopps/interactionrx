'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 2 * 60 * 1000; // 2 minutes warning

export default function SessionTimeout() {
  const { session, signOut } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const lastActivity = useRef(Date.now());
  const warningTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const resetTimers = () => {
    lastActivity.current = Date.now();
    setShowWarning(false);
    clearTimeout(warningTimer.current);
    clearTimeout(logoutTimer.current);

    warningTimer.current = setTimeout(() => {
      setShowWarning(true);
    }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);

    logoutTimer.current = setTimeout(() => {
      signOut();
      window.location.href = '/login?reason=timeout';
    }, IDLE_TIMEOUT_MS);
  };

  useEffect(() => {
    if (!session) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const onActivity = () => resetTimers();

    events.forEach((e) => window.addEventListener(e, onActivity));
    resetTimers();

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearTimeout(warningTimer.current);
      clearTimeout(logoutTimer.current);
    };
  }, [session, signOut]);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Session expiring</h3>
        <p className="mt-2 text-sm text-gray-500">
          Your session will expire due to inactivity. Move your mouse or press any key to stay signed in.
        </p>
        <button type="button" onClick={resetTimers} className="btn-primary mt-4 w-full">
          Stay signed in
        </button>
      </div>
    </div>
  );
}
