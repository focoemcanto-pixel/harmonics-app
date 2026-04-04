'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          await loadProfile(session.user);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function checkUser() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadProfile(session.user);
      }
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadProfile(user) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setUser(user);
      setProfile(data);
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      setUser(user);
      setProfile(null);
    }
  }

  async function signIn(email, password) {
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
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
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
