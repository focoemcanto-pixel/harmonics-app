'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const SAVED_LOGIN_KEY = 'harmonics_saved_login';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberLogin, setRememberLogin] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [accessHistory, setAccessHistory] = useState([]);

  const { signIn, user, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextTarget = searchParams.get('next') || '/dashboard';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const history = JSON.parse(localStorage.getItem('accessHistory') || '[]');
      setAccessHistory(Array.isArray(history) ? history : []);
    } catch {
      setAccessHistory([]);
    }

    try {
      const savedLogin = JSON.parse(localStorage.getItem(SAVED_LOGIN_KEY) || 'null');
      if (savedLogin?.email && savedLogin?.password) {
        setEmail(savedLogin.email);
        setPassword(savedLogin.password);
        setRememberLogin(true);
      }
    } catch {
      // Ignore corrupted localStorage data
    }
  }, []);

  useEffect(() => {
    if (user && profile?.role === 'admin') {
      router.push(nextTarget);
    }
  }, [user, profile, router, nextTarget]);

  const canSubmit = useMemo(() => email.trim() && password, [email, password]);

  function persistSavedLogin(nextRememberState, nextEmail, nextPassword) {
    if (typeof window === 'undefined') return;

    // Observação: armazenar senha em localStorage reduz segurança.
    // Em produção, prefira sessão persistente segura ou password manager.
    if (!nextRememberState) {
      localStorage.removeItem(SAVED_LOGIN_KEY);
      return;
    }

    localStorage.setItem(
      SAVED_LOGIN_KEY,
      JSON.stringify({
        email: nextEmail,
        password: nextPassword,
      })
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading || !canSubmit) return;

    setError('');
    setInfo('');
    setLoading(true);

    try {
      await signIn(email.trim(), password);
      persistSavedLogin(rememberLogin, email.trim(), password);
    } catch (err) {
      setError(err?.message || 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (resetLoading) return;

    setError('');
    setInfo('');

    if (!email.trim()) {
      setError('Informe seu e-mail para receber o link de redefinição.');
      return;
    }

    setResetLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (resetError) throw resetError;

      setInfo('Enviamos um link para redefinir sua senha.');
    } catch (err) {
      setError(err?.message || 'Não foi possível enviar o link de redefinição.');
    } finally {
      setResetLoading(false);
    }
  }

  function handleQuickLogin(historyEmail) {
    if (loading) return;
    setEmail(historyEmail);
  }

  function getInitials(name) {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05050c] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.24),_transparent_45%),radial-gradient(circle_at_80%_20%,_rgba(59,130,246,0.2),_transparent_32%),radial-gradient(circle_at_50%_100%,_rgba(245,158,11,0.16),_transparent_40%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md rounded-[28px] border border-white/20 bg-white/10 p-6 shadow-[0_18px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8">
          <div className="mb-6 text-center">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-200">Banda Harmonics</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white">Painel Administrativo</h1>
            <p className="mt-2 text-sm text-slate-300">
              Gestão profissional de eventos, contratos, escalas e repertórios
            </p>
          </div>

          {accessHistory.length > 0 && (
            <div className="mb-6 rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.08em] text-slate-300">Acessos recentes</p>
              <div className="space-y-2">
                {accessHistory.slice(0, 3).map((access) => (
                  <button
                    key={access.email}
                    type="button"
                    onClick={() => handleQuickLogin(access.email)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-violet-300/40"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-400/20 text-xs font-black text-violet-100">
                      {getInitials(access.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold text-white">{access.name}</span>
                      <span className="block truncate text-[11px] text-slate-300">{access.email}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="rounded-xl border border-red-300/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}
            {info && <div className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{info}</div>}

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                required
                className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={rememberLogin}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setRememberLogin(checked);
                  if (!checked && typeof window !== 'undefined') {
                    localStorage.removeItem(SAVED_LOGIN_KEY);
                  }
                }}
                className="h-4 w-4 rounded border-white/30 bg-transparent accent-violet-400"
              />
              Salvar meus dados neste dispositivo
            </label>

            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="w-full rounded-xl bg-gradient-to-r from-violet-500 via-indigo-500 to-amber-400 px-4 py-3 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Entrando...' : 'Entrar no painel'}
            </button>
          </form>

          <div className="mt-5 space-y-2 text-center">
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={resetLoading}
              className="text-sm font-semibold text-violet-200 transition hover:text-violet-100 disabled:opacity-60"
            >
              {resetLoading ? 'Enviando...' : 'Esqueci minha senha'}
            </button>

            <p className="text-xs text-slate-300">
              Primeiro acesso? Peça ao administrador para reenviar seu convite.
            </p>
            <Link href="/" className="text-xs text-slate-400 hover:text-slate-200">
              Voltar para o site
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
