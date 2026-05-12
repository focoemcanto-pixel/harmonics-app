'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getSupabase(), []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(
    searchParams?.get('signup') === 'confirmed'
      ? 'E-mail confirmado. Agora faça login para continuar.'
      : searchParams?.get('signup') === 'check-email'
        ? 'Conta criada. Confirme seu e-mail e depois faça login para finalizar seu workspace.'
        : ''
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!supabase) {
      setError('Supabase não está configurado no ambiente.');
      return;
    }

    if (!email.trim() || !password) {
      setError('Informe e-mail e senha.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (loginError) throw loginError;

      const pendingRaw = typeof window !== 'undefined' ? window.localStorage.getItem('harmonics_pending_signup_bootstrap') : null;
      if (pendingRaw) {
        try {
          const pending = JSON.parse(pendingRaw);
          const accessToken = data?.session?.access_token;

          if (accessToken && pending?.workspaceName) {
            const response = await fetch('/api/public/signup/bootstrap', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify(pending),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload?.ok) {
              throw new Error(payload?.error || 'Não foi possível finalizar seu workspace.');
            }

            window.localStorage.removeItem('harmonics_pending_signup_bootstrap');
            router.push(payload?.next || '/onboarding');
            router.refresh();
            return;
          }
        } catch (bootstrapError) {
          console.error('[LOGIN][PENDING_BOOTSTRAP_ERROR]', bootstrapError);
          setError(bootstrapError?.message || 'Login realizado, mas não foi possível finalizar o workspace.');
          return;
        }
      }

      const next = searchParams?.get('next') || '/eventos';
      router.push(next);
      router.refresh();
    } catch (err) {
      const message = String(err?.message || 'Erro ao entrar.');
      if (message.toLowerCase().includes('invalid')) {
        setError('E-mail ou senha inválidos.');
      } else if (message.toLowerCase().includes('email not confirmed')) {
        setError('Confirme seu e-mail antes de entrar.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    setError('');
    setNotice('');

    if (!supabase) {
      setError('Supabase não está configurado no ambiente.');
      return;
    }

    if (!email.trim()) {
      setError('Digite seu e-mail para receber o link de recuperação.');
      return;
    }

    setLoading(true);

    try {
      const redirectTo = `${window.location.origin}/login?reset=done`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo,
      });

      if (resetError) throw resetError;
      setNotice('Enviamos um link de recuperação para seu e-mail.');
    } catch (err) {
      setError(err?.message || 'Não foi possível enviar o link de recuperação.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-8">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-emerald-200 shadow-2xl shadow-emerald-500/10">
            Harmonics SaaS • acesso seguro
          </div>

          <div className="space-y-5">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
              Entre no painel da sua operação musical.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-300">
              Gerencie contratos, eventos, escalas, repertórios, pagamentos e automações a partir do seu workspace.
            </p>
          </div>

          <div className="grid max-w-2xl gap-3 text-sm text-slate-300 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <strong className="block text-white">Seguro</strong>
              Acesso por workspace.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <strong className="block text-white">Organizado</strong>
              Operação centralizada.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <strong className="block text-white">Escalável</strong>
              Preparado para equipes.
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/40 backdrop-blur md:p-8">
          <div className="mb-6 space-y-2">
            <h2 className="text-2xl font-semibold">Entrar</h2>
            <p className="text-sm text-slate-300">
              Acesse sua conta para continuar no Harmonics.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">E-mail</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                placeholder="voce@email.com"
                autoComplete="email"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Senha</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                placeholder="Sua senha"
                autoComplete="current-password"
              />
            </label>

            {error ? (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            {notice ? (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {notice}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-emerald-300 px-5 py-4 font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Entrando...' : 'Entrar no painel'}
            </button>
          </form>

          <button
            type="button"
            disabled={loading}
            onClick={handlePasswordReset}
            className="mt-4 w-full rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
          >
            Esqueci minha senha
          </button>

          <p className="mt-5 text-center text-sm text-slate-400">
            Ainda não tem workspace?{' '}
            <a href="/signup" className="font-medium text-emerald-200 hover:text-emerald-100">
              Começar grátis
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] px-6 py-5 text-sm text-slate-200">
            Carregando login...
          </div>
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
