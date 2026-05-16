'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

const DEFAULT_COLOR = '#8b5cf6';

function normalizeHexColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_COLOR;
}

export default function NewWorkspacePage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);

  const [workspaceName, setWorkspaceName] = useState('');
  const [supportWhatsapp, setSupportWhatsapp] = useState('');
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_COLOR);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function checkSession() {
      if (!supabase) {
        setError('Supabase não está configurado no ambiente.');
        setCheckingSession(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;

      if (!data?.session?.access_token) {
        router.replace('/login?next=/workspace/new');
        return;
      }

      setCheckingSession(false);
    }

    checkSession();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!supabase) {
      setError('Supabase não está configurado no ambiente.');
      return;
    }

    if (!workspaceName.trim()) {
      setError('Informe o nome do workspace, banda ou equipe.');
      return;
    }

    setLoading(true);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data?.session?.access_token;

      if (!accessToken) {
        router.replace('/login?next=/workspace/new');
        return;
      }

      const response = await fetch('/api/workspace/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          workspaceName,
          supportWhatsapp,
          primaryColor: normalizeHexColor(primaryColor),
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Não foi possível criar o workspace.');
      }

      router.push(payload?.next || '/dashboard');
      router.refresh();
    } catch (err) {
      setError(err?.message || 'Não foi possível criar o workspace.');
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] px-6 py-5 text-sm font-semibold text-slate-200">
          Validando sessão...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center">
        <div className="grid w-full overflow-hidden rounded-[34px] border border-white/15 bg-white/[0.06] shadow-[0_35px_120px_rgba(2,6,23,0.65)] backdrop-blur-xl lg:grid-cols-[0.9fr_1.1fr]">
          <section className="bg-gradient-to-br from-violet-700/35 via-fuchsia-600/20 to-emerald-400/10 p-8 md:p-10">
            <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-black uppercase tracking-[0.12em] text-violet-100">
              Novo workspace
            </p>
            <h1 className="mt-8 text-4xl font-black leading-tight tracking-[-0.05em] md:text-5xl">
              Crie um workspace para sua conta existente.
            </h1>
            <p className="mt-5 text-sm font-semibold leading-7 text-slate-200">
              Este fluxo é autenticado e serve para quem já tem conta no Harmonics. Ele não cria uma conta pública nova e não usa a página de signup.
            </p>
            <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-5 text-sm font-semibold leading-7 text-slate-200">
              Depois da criação, você será definido como owner do workspace e poderá continuar no painel.
            </div>
          </section>

          <section className="p-6 sm:p-8 md:p-10">
            <h2 className="text-3xl font-black tracking-[-0.04em]">Dados iniciais</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Preencha apenas as informações básicas. Configurações avançadas podem ser ajustadas depois.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              {error ? (
                <div className="rounded-2xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
                  {error}
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-200">
                  Nome do workspace/banda/equipe
                </label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  required
                  disabled={loading}
                  className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-sm text-white placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-60"
                  placeholder="Ex.: Banda Harmonics"
                  autoComplete="organization"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-200">
                  WhatsApp principal <span className="text-slate-400">(opcional)</span>
                </label>
                <input
                  type="tel"
                  value={supportWhatsapp}
                  onChange={(event) => setSupportWhatsapp(event.target.value)}
                  disabled={loading}
                  className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-sm text-white placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-60"
                  placeholder="+55 11 99999-9999"
                  autoComplete="tel"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-200">
                  Cor principal <span className="text-slate-400">(opcional)</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={normalizeHexColor(primaryColor)}
                    onChange={(event) => setPrimaryColor(event.target.value)}
                    disabled={loading}
                    className="h-14 w-16 rounded-2xl border border-white/15 bg-white/10 p-2 disabled:opacity-60"
                    aria-label="Cor principal do workspace"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(event) => setPrimaryColor(event.target.value)}
                    disabled={loading}
                    className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-sm text-white placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-60"
                    placeholder={DEFAULT_COLOR}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-purple-700 px-6 py-4 text-sm font-black text-white shadow-[0_18px_42px_rgba(124,58,237,0.38)] transition hover:from-violet-500 hover:via-fuchsia-500 hover:to-purple-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Criando workspace...' : 'Criar workspace'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
