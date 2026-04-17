'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [authError, setAuthError] = useState(null);
  const sessionFlowRef = useRef(Promise.resolve());
  const isMountedRef = useRef(false);

  const loadProfile = useCallback(async (user) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setUser(user);
      setProfile(data);
      setAuthError(null);
      console.info('[Auth] perfil resolvido', {
        userId: user?.id || null,
        role: data?.role || null,
      });
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      setUser(user);
      setProfile(null);
      setAuthError(error?.message || 'Erro ao carregar perfil');
    }
  }, []);

  const applySessionState = useCallback(async (session) => {
    if (session?.user) {
      await loadProfile(session.user);
      return;
    }

    setUser(null);
    setProfile(null);
  }, [loadProfile]);

  const runSessionFlow = useCallback((session, source = 'unknown', options = {}) => {
    const { markLoading = false } = options;

    sessionFlowRef.current = sessionFlowRef.current
      .catch(() => undefined)
      .then(async () => {
        if (!isMountedRef.current) return;

        console.info('[Auth] sync session', {
          source,
          hasSession: Boolean(session?.user),
          userId: session?.user?.id || null,
        });

        setAuthError(null);
        if (markLoading) setLoading(true);
        await applySessionState(session);
        if (!isMountedRef.current) return;
        setInitialized(true);
        setLoading(false);
      })
      .catch((error) => {
        if (!isMountedRef.current) return;
        console.error('[Auth] falha ao sincronizar sessão:', error);
        setAuthError(error?.message || 'Erro ao sincronizar sessão');
        setInitialized(true);
        setLoading(false);
      });

    return sessionFlowRef.current;
  }, [applySessionState]);

  useEffect(() => {
    let active = true;
    isMountedRef.current = true;

    if (!supabase) {
      const errorMessage = 'Supabase client indisponível no browser';
      console.error('[Auth] erro crítico:', errorMessage);
      setAuthError(errorMessage);
      setLoading(false);
      setInitialized(true);
      return undefined;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!active) return;
        console.info('[Auth] onAuthStateChange', {
          event,
          hasSession: Boolean(session?.user),
          userId: session?.user?.id || null,
        });

        if (event === 'INITIAL_SESSION') {
          return;
        }

        await runSessionFlow(session, `listener:${event}`);
      }
    );

    (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active) return;
        await runSessionFlow(session, 'bootstrap:getSession', { markLoading: true });
      } catch (error) {
        if (!active) return;
        console.error('[Auth] falha no bootstrap de sessão:', error);
        setAuthError(error?.message || 'Erro ao verificar sessão');
        setInitialized(true);
        setLoading(false);
      }
    })();

    return () => {
      active = false;
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [runSessionFlow]);

  async function signIn(email, password) {
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Carregar profile e usar o retorno direto (não o state) para evitar race condition
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) throw profileError;

    setUser(data.user);
    setProfile(userProfile);

    return data;
  }

  async function signOut() {
    try {
      if (typeof window !== 'undefined' && profile?.email) {
        try {
          const existing = JSON.parse(localStorage.getItem('accessHistory') || '[]');
          const updated = [
            { email: profile.email, name: profile.name || profile.email, lastAccess: new Date().toISOString() },
            ...existing.filter((h) => h.email !== profile.email),
          ].slice(0, 5);
          localStorage.setItem('accessHistory', JSON.stringify(updated));
        } catch {
          // Ignore storage errors
        }
      }
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      setUser(null);
      setProfile(null);
    }
  }

  const value = {
    user,
    profile,
    role: profile?.role || null,
    loading,
    initialized,
    authError,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {initialized ? children : (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600 mx-auto mb-3" />
            <p className="text-slate-600 text-sm">Verificando sessão...</p>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
