'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { Permission, UserProfile } from '@/lib/permissions';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  permissions: Permission[];
  loading: boolean;
  setupError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchProfile() {
  try {
    const data = await api.getSessionInfo();
    const setupError = data.securitySetupPending
      ? 'Security tables not installed. Run supabase/security.sql in Supabase SQL Editor.'
      : null;
    return { profile: data.profile, permissions: data.permissions, setupError };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load profile';
    if (message.includes('User profile not found')) {
      return { profile: null, permissions: [] as Permission[], setupError: message };
    }
    if (message.includes('infinite recursion') || message.includes('security-policy-fix')) {
      return {
        profile: null,
        permissions: ['read'] as Permission[],
        setupError: 'policy_recursion',
      };
    }
    return { profile: null, permissions: ['read'] as Permission[], setupError: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    const { profile: p, permissions: perms, setupError: err } = await fetchProfile();
    setProfile(p);
    setPermissions(perms);
    setSetupError(err);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session) await loadProfile();
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session) {
          await loadProfile();
        } else {
          setProfile(null);
          setPermissions([]);
          setSetupError(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await loadProfile();
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
    setPermissions([]);
    setSetupError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        permissions,
        loading,
        setupError,
        signIn,
        signOut,
        refreshProfile: loadProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
