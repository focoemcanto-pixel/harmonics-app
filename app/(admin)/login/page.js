'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const SAVED_LOGIN_KEY = 'harmonics_saved_admin_login';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberLogin, setRememberLogin] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [saveAccess, setSaveAccess] = useState(false);
  const [accessHistory, setAccessHistory] = useState([]);

  const { signIn, user, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextTarget = searchParams.get('next') || '/dashboard';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const history = JSON.parse(localStorage.getItem('accessHistory') || '[]');
    setAccessHistory(history);

    const savedCredentialsRaw = localStorage.getItem(SAVED_LOGIN_KEY);
    if (!savedCredentialsRaw) return;

    try {
      const savedCredentials = JSON.parse(savedCredentialsRaw);
      if (savedCredentials?.email && savedCredentials?.password) {
        setEmail(savedCredentials.email);
        setPassword(savedCredentials.password);
        setSaveAccess(true);
      }
    } catch {
      localStorage.removeItem(SAVED_LOGIN_KEY);
    }
  }, []);

  useEffect(() => {
    if (user && profile?.role === 'admin') {
      router.push(nextTarget);
    }
  }, [user, profile, router, nextTarget]);

  const gradientButtonClass = useMemo(
    () =>
      'w-full rounded-2xl px-6 py-4 text-sm font-black text-white shadow-[0_14px_30px_rgba(99,102,241,0.35)] transition focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-60 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-purple-700 hover:from-violet-500 hover:via-fuchsia-500 hover:to-purple-600',
    []
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setError('');
    setFeedback('');
    setLoading(true);

    try {
      await signIn(email, password);

      if (typeof window !== 'undefined') {
        if (saveAccess) {
          localStorage.setItem(
            SAVED_LOGIN_KEY,
            JSON.stringify({
              email,
              password,
              savedAt: new Date().toISOString(),
            })
          );
        } else {
          localStorage.removeItem(SAVED_LOGIN_KEY);
        }
      }
    } catch (err) {
      setError(err?.message || 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  }

  function handleQuickLogin(histEmail) {
    if (loading) return;
    setEmail(histEmail);
    setPassword('');
    setFeedback('');
    setError('');
  }

  function handleToggleSaveAccess(checked) {
    setSaveAccess(checked);
    if (!checked && typeof window !== 'undefined') {
      localStorage.removeItem(SAVED_LOGIN_KEY);
    }
  }

  async function handleForgotPassword() {
    setError('');
    setFeedback('');

    if (!email.trim()) {
      setError('Informe seu email para enviar o link de redefinição de senha.');
      return;
    }

    setResettingPassword(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (resetError) {
        throw resetError;
      }

      setFeedback('Enviamos um link para redefinir sua senha.');
    } catch {
      setError('Não foi possível enviar o link agora. Verifique o email e tente novamente.');
    } finally {
      setResettingPassword(false);
    }
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
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-violet-700/25 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="absolute left-0 top-1/3 h-80 w-80 rounded-full bg-indigo-600/20 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-4 py-10 md:px-8">
        <div className="grid w-full overflow-hidden rounded-[34px] border border-white/15 bg-white/[0.06] shadow-[0_35px_120px_rgba(2,6,23,0.65)] backdrop-blur-xl lg:grid-cols-[1.06fr_0.94fr]">
          <section className="hidden p-10 lg:flex lg:flex-col lg:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-black uppercase tracking-[0.12em] text-violet-100">
                Banda Harmonics
              </p>
              <h1 className="mt-8 text-4xl font-black leading-tight text-white">
                Harmonics Admin
              </h1>
              <p className="mt-4 max-w-md text-sm text-slate-200/90">
                Gestão profissional de eventos, contratos, escalas e repertórios.
              </p>
            </div>

            <ul className="space-y-4 text-sm text-slate-200/90">
              {[
                'Gestão centralizada de equipe e produção.',
                'Acompanhamento de contratos e pagamentos em um único painel.',
                'Fluxos organizados para uma operação mais previsível.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-violet-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="p-6 sm:p-8 md:p-10">
            <div className="mx-auto w-full max-w-md">
              <div className="text-center lg:hidden">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-violet-200">Banda Harmonics</p>
              </div>

              <h2 className="mt-2 text-center text-3xl font-black tracking-tight text-white">
                Harmonics Admin
              </h2>
              <p className="mt-2 text-center text-sm text-slate-300">
                Gestão profissional de eventos, contratos, escalas e repertórios.
              </p>

              {accessHistory.length > 0 && (
                <div className="mt-6 rounded-2xl border border-white/15 bg-slate-900/45 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-300">Acessos recentes</p>
                  <div className="mt-3 space-y-2">
                    {accessHistory.slice(0, 2).map((access) => (
                      <button
                        key={access.email}
                        type="button"
                        onClick={() => handleQuickLogin(access.email)}
                        disabled={loading}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-violet-300/50 hover:bg-violet-400/10 disabled:opacity-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/25 text-xs font-black text-violet-100">
                            {getInitials(access.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{access.name}</p>
                            <p className="truncate text-xs text-slate-300">{access.email}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {error && (
                  <div className="rounded-2xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    {error}
                  </div>
                )}

                {feedback && (
                  <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    {feedback}
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-200">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-sm text-white placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-60"
                    placeholder="seu@email.com"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-200">Senha</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-sm text-white placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-60"
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={saveAccess}
                      onChange={(e) => handleToggleSaveAccess(e.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-transparent accent-violet-500"
                    />
                    Salvar acesso neste dispositivo
                  </label>

                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={resettingPassword || loading}
                    className="text-xs font-semibold text-violet-200 transition hover:text-violet-100 disabled:opacity-50"
                  >
                    {resettingPassword ? 'Enviando...' : 'Esqueci minha senha'}
                  </button>
                </div>

                {/* Este recurso salva a senha localmente por escolha de comodidade em dispositivo privado. Em ambiente multiusuário, preferir gerenciador de senhas. */}

                <button type="submit" disabled={loading} className={gradientButtonClass}>
                  {loading ? 'Entrando...' : 'Entrar no painel'}
                </button>
              </form>

              <p className="mt-5 text-center text-xs text-slate-400">
                Acesso restrito a administradores autorizados.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
