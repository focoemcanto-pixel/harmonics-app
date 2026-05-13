'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

const PENDING_SIGNUP_KEY = 'harmonics_pending_signup_bootstrap';

function normalizePhone(value) {
  return String(value || '').replace(/\D+/g, '');
}

function savePendingSignupBootstrap(form) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    PENDING_SIGNUP_KEY,
    JSON.stringify({
      fullName: form.fullName.trim(),
      workspaceName: form.workspaceName.trim(),
      supportWhatsapp: normalizePhone(form.whatsapp),
      timezone: 'America/Bahia',
      createdAt: new Date().toISOString(),
    })
  );
}

export default function SignupPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    workspaceName: '',
    whatsapp: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [existingWorkspace, setExistingWorkspace] = useState(false);

  function updateField(field, value) {
    setExistingWorkspace(false);
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleExistingWorkspace() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(PENDING_SIGNUP_KEY);
    }

    setError('');
    setSuccess('');
    setExistingWorkspace(true);
  }

  async function bootstrapWorkspace(accessToken) {
    const response = await fetch('/api/public/signup/bootstrap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        fullName: form.fullName.trim(),
        workspaceName: form.workspaceName.trim(),
        supportWhatsapp: normalizePhone(form.whatsapp),
        timezone: 'America/Bahia',
      }),
    });

    const payload = await response.json().catch(() => null);

    if (response.status === 409 && payload?.code === 'USER_ALREADY_HAS_WORKSPACE') {
      handleExistingWorkspace();
      return null;
    }

    if (!response.ok || !payload?.ok) {
      const error = new Error(payload?.error || 'Não foi possível inicializar seu workspace.');
      error.code = payload?.code || null;
      throw error;
    }

    return payload;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setExistingWorkspace(false);

    if (!supabase) {
      setError('Supabase não está configurado no ambiente.');
      return;
    }

    if (!form.fullName.trim()) {
      setError('Informe seu nome.');
      return;
    }

    if (!form.email.trim()) {
      setError('Informe seu e-mail.');
      return;
    }

    if (String(form.password || '').length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }

    if (!form.workspaceName.trim()) {
      setError('Informe o nome da sua banda, equipe ou empresa.');
      return;
    }

    setLoading(true);

    try {
      savePendingSignupBootstrap(form);
      const redirectTo = `${window.location.origin}/login?signup=confirmed`;

      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: form.fullName.trim(),
            workspace_name: form.workspaceName.trim(),
            signup_source: 'public_signup_page',
          },
        },
      });

      if (signupError) throw signupError;

      let accessToken = signupData?.session?.access_token || null;

      if (!accessToken) {
        const sessionResult = await supabase.auth.getSession();
        accessToken = sessionResult?.data?.session?.access_token || null;
      }

      if (!accessToken) {
        setSuccess('Conta criada! Confirme seu e-mail e depois faça login para finalizar o workspace.');
        router.push('/login?signup=check-email');
        return;
      }

      const payload = await bootstrapWorkspace(accessToken);
      if (!payload) return;

      window.localStorage.removeItem(PENDING_SIGNUP_KEY);
      setSuccess('Conta criada! Vamos finalizar a configuração inicial.');
      router.push(payload?.next || '/onboarding');
    } catch (err) {
      const message = String(err?.message || 'Erro ao criar conta.');
      if (err?.code === 'USER_ALREADY_HAS_WORKSPACE' || message.toLowerCase().includes('workspace ativo')) {
        handleExistingWorkspace();
      } else if (message.toLowerCase().includes('already')) {
        setError('Já existe uma conta com este e-mail. Tente fazer login.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-8">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-emerald-200 shadow-2xl shadow-emerald-500/10">
            Harmonics SaaS • gestão musical inteligente
          </div>

          <div className="space-y-5">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
              Organize eventos, contratos, escalas e automações em um só lugar.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-300">
              Crie seu workspace gratuito e comece a estruturar a operação da sua banda, ministério ou equipe musical com uma base profissional.
            </p>
          </div>

          <div className="grid max-w-2xl gap-3 text-sm text-slate-300 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <strong className="block text-white">Contratos</strong>
              Links, assinatura e PDFs.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <strong className="block text-white">Escalas</strong>
              Convites e confirmação.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <strong className="block text-white">Automação</strong>
              WhatsApp e lembretes.
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/40 backdrop-blur md:p-8">
          {existingWorkspace ? (
            <div className="space-y-5">
              <div className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-emerald-100">
                Workspace já encontrado
              </div>

              <div className="space-y-3">
                <h2 className="text-2xl font-semibold">Este e-mail já possui um workspace.</h2>
                <p className="text-sm leading-6 text-slate-300">
                  Para continuar, faça login com este e-mail e acesse normalmente o painel do seu workspace.
                </p>
              </div>

              <Link
                href="/login"
                className="block w-full rounded-2xl bg-emerald-300 px-5 py-4 text-center font-semibold text-slate-950 transition hover:bg-emerald-200"
              >
                Entrar no painel
              </Link>

              <button
                type="button"
                onClick={() => setExistingWorkspace(false)}
                className="w-full rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10"
              >
                Usar outro e-mail
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6 space-y-2">
                <h2 className="text-2xl font-semibold">Criar workspace</h2>
                <p className="text-sm text-slate-300">
                  Comece no plano Free. Você poderá configurar seu WhatsApp, equipe e identidade depois.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block space-y-2">
                  <span className="text-sm text-slate-300">Seu nome</span>
                  <input value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-emerald-300" placeholder="Ex: Marcos Cruz" autoComplete="name" />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm text-slate-300">E-mail</span>
                  <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-emerald-300" placeholder="voce@email.com" autoComplete="email" />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm text-slate-300">Senha</span>
                  <input type="password" value={form.password} onChange={(event) => updateField('password', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-emerald-300" placeholder="Mínimo de 8 caracteres" autoComplete="new-password" />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm text-slate-300">Nome da banda/equipe</span>
                  <input value={form.workspaceName} onChange={(event) => updateField('workspaceName', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-emerald-300" placeholder="Ex: Harmonics Eventos" />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm text-slate-300">WhatsApp principal</span>
                  <input value={form.whatsapp} onChange={(event) => updateField('whatsapp', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-emerald-300" placeholder="Ex: 71999999999" inputMode="tel" />
                </label>

                {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
                {success ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{success}</div> : null}

                <button type="submit" disabled={loading} className="w-full rounded-2xl bg-emerald-300 px-5 py-4 font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? 'Criando workspace...' : 'Começar grátis'}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-slate-400">
                Já tem conta? <Link href="/login" className="font-medium text-emerald-200 hover:text-emerald-100">Entrar</Link>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
