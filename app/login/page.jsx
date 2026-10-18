'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import PublicFooter from '@/components/public/PublicFooter';
import {
  Alert,
  BrandMark,
  PublicBackground,
  PublicLoading,
  Spinner,
  inputClass,
  labelClass,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/components/public/PublicUI';

function getSafeNext(searchParams) {
  const next = searchParams?.get('next') || '/eventos';

  if (!next.startsWith('/') || next.startsWith('//')) {
    return '/eventos';
  }

  return next;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getSupabase(), []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(
    searchParams?.get('signup') === 'confirmed'
      ? 'E-mail confirmado. Agora faça login para continuar.'
      : searchParams?.get('signup') === 'check-email'
        ? 'Conta criada. Confirme seu e-mail e depois faça login para finalizar seu workspace.'
        : ''
  );

  // Compatibilidade: links de recuperação antigos apontavam para /login?reset=done, que não
  // tem formulário de nova senha. Se a URL trouxer o token de recuperação, encaminha.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash || '';
    const params = new URLSearchParams(window.location.search);
    const isRecoveryHash = hash.includes('type=recovery') || (hash.includes('access_token=') && params.get('reset') === 'done');
    const isRecoveryCode = params.get('reset') === 'done' && params.get('code');
    if (isRecoveryHash || isRecoveryCode) {
      const query = params.get('code') ? `?code=${encodeURIComponent(params.get('code'))}` : '';
      window.location.replace(`/auth/reset-password${query}${hash}`);
    }
  }, []);

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
      router.replace('/workspace/new');
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

      // Os dados do cadastro pendente (nome da banda, WhatsApp) são consumidos por
      // /workspace/new quando o workspace ainda não existe; não descartar aqui.

      const accessToken = data?.session?.access_token || null;
      const next = getSafeNext(searchParams);

      if (next !== '/workspace/new') {
        const hasWorkspace = await verifyWorkspaceOrRedirect(accessToken);
        if (!hasWorkspace) return;
      }

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
      const redirectTo = `${window.location.origin}/auth/reset-password`;
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

  const linkClass = 'font-semibold text-violet-200 underline-offset-4 hover:text-white hover:underline';

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-slate-950 text-white">
      <PublicBackground />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-5 md:px-6">
        <BrandMark />
        <p className="text-sm text-slate-400">
          Novo por aqui? <Link href="/signup" className={linkClass}>Criar conta</Link>
        </p>
      </header>

      <main className="relative z-10 mx-auto grid grid-cols-1 w-full max-w-6xl items-center gap-10 px-4 pb-16 pt-4 md:px-6 md:pt-10 lg:grid-cols-[1fr_0.9fr]">
        <section className="hidden lg:block">
          <h1 className="max-w-xl text-5xl font-black leading-[1.02] tracking-[-0.05em]">
            Bem-vindo de volta ao seu espaço.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
            Eventos, contratos, escalas, repertórios, pagamentos e automações da sua banda continuam exatamente onde você deixou.
          </p>
          <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
            {[
              ['Contratos', 'Links, PDFs e assinatura'],
              ['Escalas', 'Convites e confirmações'],
              ['Automação', 'WhatsApp e lembretes'],
            ].map(([title, subtitle]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                <strong className="block text-sm text-white">{title}</strong>
                <span className="mt-1 block text-xs leading-5 text-slate-400">{subtitle}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={`mx-auto w-full max-w-md p-6 sm:p-8 ${panelClass}`}>
          <h2 className="text-3xl font-black tracking-[-0.04em]">Entrar</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Acesse o painel da sua banda, ministério ou equipe musical.</p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {error ? <Alert tone="error">{error}</Alert> : null}
            {notice ? <Alert tone="success">{notice}</Alert> : null}

            <label className="block">
              <span className={labelClass}>E-mail</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={loading}
                className={inputClass}
                placeholder="voce@email.com"
                autoComplete="email"
              />
            </label>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="login-password" className="text-sm font-semibold text-slate-200">Senha</label>
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={loading}
                  className="text-xs font-semibold text-violet-200 transition hover:text-white disabled:opacity-50"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={loading}
                  className={`${inputClass} pr-20`}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-3 my-auto h-8 rounded-lg px-2 text-xs font-bold text-slate-300 hover:text-white" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className={`${primaryButtonClass} w-full`}>
              {loading ? (<><Spinner /> Entrando...</>) : 'Entrar no painel'}
            </button>
          </form>

          <div className="mt-6 border-t border-white/10 pt-6 text-center">
            <p className="text-sm text-slate-400">Ainda não usa o Harmonics?</p>
            <Link href="/signup" className={`${secondaryButtonClass} mt-3 w-full py-3`}>
              Começar grátis
            </Link>
            <Link href="/planos" className={`${linkClass} mt-3 inline-block text-sm`}>
              Conhecer os planos
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="bg-slate-950">
      <Suspense fallback={<PublicLoading label="Carregando..." />}>
        <LoginPageContent />
      </Suspense>
      <PublicFooter />
    </div>
  );
}
