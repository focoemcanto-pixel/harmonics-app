'use client';

import Link from 'next/link';
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

  async function verifyWorkspaceOrRedirect(accessToken) {
    if (!accessToken) return false;

    const response = await fetch('/api/workspace/me', {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.ok) return true;

    const payload = await response.json().catch(() => null);
    const message = String(payload?.error || '').toLowerCase();

    if (response.status === 403 || message.includes('não pertence') || message.includes('workspace')) {
      await supabase?.auth?.signOut?.();
      router.replace('/no-workspace');
      return false;
    }

    throw new Error(payload?.error || 'Não foi possível validar seu workspace.');
  }

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

      const accessToken = data?.session?.access_token || null;
      const hasWorkspace = await verifyWorkspaceOrRedirect(accessToken);
      if (!hasWorkspace) return;

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

  const gradientButtonClass =
    'w-full rounded-2xl px-6 py-4 text-sm font-black text-white shadow-[0_18px_42px_rgba(124,58,237,0.38)] transition focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-60 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-purple-700 hover:from-violet-500 hover:via-fuchsia-500 hover:to-purple-600';

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-700/25 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="absolute left-0 top-1/3 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_34%)]" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-4 py-10 md:px-8">
        <div className="grid w-full overflow-hidden rounded-[34px] border border-white/15 bg-white/[0.06] shadow-[0_35px_120px_rgba(2,6,23,0.65)] backdrop-blur-xl lg:grid-cols-[1.06fr_0.94fr]">
          <section className="hidden p-10 lg:flex lg:flex-col lg:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-black uppercase tracking-[0.12em] text-violet-100">
                Harmonics SaaS
              </p>
              <h1 className="mt-8 max-w-xl text-5xl font-black leading-[0.98] tracking-[-0.06em] text-white">
                Acesse seu workspace musical inteligente.
              </h1>
              <p className="mt-5 max-w-md text-sm leading-7 text-slate-200/90">
                Gerencie eventos, contratos, escalas, repertórios, pagamentos e automações em um painel premium preparado para equipes musicais.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  ['Contratos', 'Links, PDFs e assinatura'],
                  ['Escalas', 'Convites e confirmações'],
                  ['Automação', 'WhatsApp e lembretes'],
                ].map(([title, subtitle]) => (
                  <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                    <strong className="block text-sm text-white">{title}</strong>
                    <span className="mt-1 block text-xs leading-5 text-slate-300">{subtitle}</span>
                  </div>
                ))}
              </div>

              <ul className="space-y-4 text-sm text-slate-200/90">
                {[
                  'Cada equipe opera dentro do seu próprio workspace.',
                  'Acesso com segurança, isolamento e governança por plano.',
                  'Preparado para crescimento, automações e operação profissional.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-violet-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="p-6 sm:p-8 md:p-10">
            <div className="mx-auto w-full max-w-md">
              <div className="text-center lg:hidden">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-violet-200">Harmonics SaaS</p>
              </div>

              <div className="text-center lg:text-left">
                <h2 className="mt-2 text-3xl font-black tracking-tight text-white">
                  Entrar no painel
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Acesse seu workspace para continuar a operação da sua banda, ministério ou equipe musical.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                {error ? (
                  <div className="rounded-2xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    {error}
                  </div>
                ) : null}

                {notice ? (
                  <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    {notice}
                  </div>
                ) : null}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-200">E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    disabled={loading}
                    className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-sm text-white placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-60"
                    placeholder="voce@email.com"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-200">Senha</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    disabled={loading}
                    className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-sm text-white placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-60"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">Acesso seguro por workspace</span>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={loading}
                    className="text-xs font-semibold text-violet-200 transition hover:text-violet-100 disabled:opacity-50"
                  >
                    Esqueci minha senha
                  </button>
                </div>

                <button type="submit" disabled={loading} className={gradientButtonClass}>
                  {loading ? 'Entrando...' : 'Entrar no painel'}
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/45 p-4 text-center">
                <p className="text-sm text-slate-300">Ainda não tem workspace?</p>
                <Link href="/signup" className="mt-3 inline-flex w-full justify-center rounded-2xl border border-white/15 px-5 py-3 text-sm font-black text-violet-100 transition hover:bg-white/10">
                  Começar grátis
                </Link>
              </div>

              <p className="mt-5 text-center text-xs text-slate-500">
                Plataforma multi-workspace para gestão musical profissional.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
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
