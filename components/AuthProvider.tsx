'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClientSafe } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { clearAuthCallbackParams, formatAuthError, parseAuthCallbackError } from '@/lib/auth-errors';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signInWithPhone: (phone: string) => Promise<{ error: string | null }>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ error: string | null }>;
  authCallbackError: string | null;
  clearAuthCallbackError: () => void;
  signInWithOAuth: (provider: 'github' | 'google') => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isConfigured: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signInWithEmail: async () => ({ error: 'Supabase 未配置' }),
  signInWithPhone: async () => ({ error: 'Supabase 未配置' }),
  authCallbackError: null,
  clearAuthCallbackError: () => {},
  verifyPhoneOtp: async () => ({ error: 'Supabase 未配置' }),
  signInWithOAuth: async () => ({ error: 'Supabase 未配置' }),
  signOut: async () => {},
  isConfigured: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured());
  const [authCallbackError, setAuthCallbackError] = useState<string | null>(null);
  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    const callbackError = parseAuthCallbackError();
    if (callbackError) {
      setAuthCallbackError(callbackError);
      clearAuthCallbackParams();
    }
  }, []);

  useEffect(() => {
    const supabase = createClientSafe();
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    loading,
    isConfigured,
    signInWithEmail: async (email: string) => {
      const supabase = createClientSafe();
      if (!supabase) return { error: 'Supabase 未配置' };
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      return { error: formatAuthError(error) };
    },
    signInWithPhone: async (phone: string) => {
      const supabase = createClientSafe();
      if (!supabase) return { error: 'Supabase 未配置' };
      const { error } = await supabase.auth.signInWithOtp({ phone });
      return { error: formatAuthError(error) };
    },
    verifyPhoneOtp: async (phone: string, token: string) => {
      const supabase = createClientSafe();
      if (!supabase) return { error: 'Supabase 未配置' };
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms',
      });
      return { error: formatAuthError(error) };
    },
    signInWithOAuth: async (provider: 'github' | 'google') => {
      const supabase = createClientSafe();
      if (!supabase) return { error: 'Supabase 未配置' };
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      return { error: formatAuthError(error) };
    },
    signOut: async () => {
      const supabase = createClientSafe();
      if (supabase) await supabase.auth.signOut();
    },
    authCallbackError,
    clearAuthCallbackError: () => setAuthCallbackError(null),
  }), [user, session, loading, isConfigured, authCallbackError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
