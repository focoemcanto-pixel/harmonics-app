'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

function normalizePhone(value) {
  return String(value || '').replace(/\D+/g, '');
}

const FIRST_STEPS = [
  {
    key: 'branding',
    title: 'Configure sua identidade',
    description: 'Nome público, WhatsApp e cor principal do workspace.',
  },
  {
    key: 'event',
    title: 'Crie seu primeiro evento',
    description: 'Monte um evento teste para aprender o fluxo.',
  },
  {
    key: 'automation',
    title: 'Conecte um canal WhatsApp',
    description: 'Escolha Evolution, Z-API, Meta Cloud API ou outro provider.',
  },
  {
    key: 'team',
    title: 'Convide sua equipe',
    description: 'Adicione músicos, admins ou equipe operacional.',
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [workspace, setWorkspace] = useState(null);
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({
    publicName: '',
    supportWhatsapp: '',
    primaryColor: '#10b981',
  });

  useEffect(() => {
    let mounted = true;

    async function loadContext() {
      try {
        setLoading(true);
        setError('');

        if (!supabase) {
          throw new Error('Supabase não está configurado.');
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (!token) {
          router.replace('/login?next=/onboarding');
          return;
        }

        const response = await fetch('/api/workspace/current', {
          headers: { Authorization: `Bearer ${token}` },
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || 'Não foi possível carregar o workspace.');
        }

        if (!mounted) return;

        const resolvedWorkspace = payload.workspace || payload.data?.workspace || null;
        const resolvedSettings = payload.settings || payload.data?.settings || null;

        setWorkspace(resolvedWorkspace);
        setSettings(resolvedSettings);
        setForm({
          publicName: resolvedSettings?.public_name || resolvedSettings?.company_name || resolvedWorkspace?.name || '',
          supportWhatsapp: resolvedSettings?.support_whatsapp || resolvedSettings?.admin_whatsapp || '',
          primaryColor: resolvedSettings?.primary_color || '#10b981',
        });
      } catch (err) {
        if (mounted) setError(err?.message || 'Erro ao carregar onboarding.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadContext();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (!workspace?.id) throw new Error('Workspace não encontrado.');

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          publicName: form.publicName.trim(),
          supportWhatsapp: normalizePhone(form.supportWhatsapp),
          primaryColor: form.primaryColor,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Não foi possível concluir o onboarding.');
      }

      router.push('/eventos?tour=first-event');
    } catch (err) {
      setError(err?.message || 'Erro ao salvar onboarding.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/30">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
          <p className="text-sm text-slate-300">Preparando seu workspace...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-0 top-0 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-violet-600/10 blur-3xl" />
      </div>

      <section className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl items-center gap-8 px-6 py-10 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-7">
          <div className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">
            Workspace criado com sucesso
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tight md:text-6xl">
              Agora vamos transformar isso em uma operação profissional.
            </h1>
            <p className="max-w-xl text-lg leading-8 text-slate-300">
              Você já possui um workspace ativo. Agora vamos configurar identidade, automações e o primeiro fluxo real do sistema.
            </p>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.12em] text-emerald-200">
                  Checklist inicial
                </div>
                <div className="mt-2 text-xl font-black text-white">
                  Primeiros passos do seu workspace
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                <div className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">Status</div>
                <div className="mt-1 text-lg font-black text-white">1 / 4</div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {FIRST_STEPS.map((step, index) => (
                <div key={step.key} className={`rounded-2xl border px-4 py-4 ${index === 0 ? 'border-emerald-300/30 bg-emerald-400/10' : 'border-white/10 bg-white/[0.03]'}`}>
                  <div className="flex items-start gap-4">
                    <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${index === 0 ? 'bg-emerald-300 text-slate-950' : 'bg-white/10 text-white'}`}>
                      {index + 1}
                    </div>

                    <div>
                      <div className="text-[15px] font-black text-white">
                        {step.title}
                      </div>
                      <div className="mt-1 text-[13px] leading-6 text-slate-300">
                        {step.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
            <p className="font-medium text-white">Plano atual</p>
            <p className="mt-1">Você começou no plano Free. Upgrade, billing e limites inteligentes já estão preparados na estrutura SaaS.</p>
          </div>
        </div>

        <div className="rounded-[2.2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/40 backdrop-blur md:p-8">
          <div className="mb-6">
            <div className="text-xs font-black uppercase tracking-[0.12em] text-emerald-200">
              Identidade inicial
            </div>
            <h2 className="mt-2 text-3xl font-black">Configuração do workspace</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Workspace: <span className="text-white">{workspace?.name || 'Novo workspace'}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-200">Nome público</span>
              <input value={form.publicName} onChange={(event) => updateField('publicName', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-emerald-300" placeholder="Ex: Rocha Worship" />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-200">WhatsApp de suporte/admin</span>
              <input value={form.supportWhatsapp} onChange={(event) => updateField('supportWhatsapp', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-emerald-300" placeholder="Ex: 71999999999" inputMode="tel" />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-200">Cor principal</span>
              <div className="flex gap-3">
                <input type="color" value={form.primaryColor} onChange={(event) => updateField('primaryColor', event.target.value)} className="h-12 w-16 rounded-2xl border border-white/10 bg-slate-900 p-1" />
                <input value={form.primaryColor} onChange={(event) => updateField('primaryColor', event.target.value)} className="flex-1 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-emerald-300" />
              </div>
            </label>

            <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-5 py-4">
              <div className="text-sm font-black text-violet-100">
                O que acontece depois?
              </div>
              <div className="mt-2 space-y-2 text-[13px] leading-6 text-violet-50/90">
                <div>• Vamos abrir um tour guiado no painel.</div>
                <div>• Você poderá criar um evento teste.</div>
                <div>• O sistema mostrará como funcionam escalas e contratos.</div>
                <div>• Depois você poderá conectar sua API WhatsApp.</div>
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            <button type="submit" disabled={saving} className="w-full rounded-2xl bg-emerald-300 px-5 py-4 font-black text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? 'Preparando workspace...' : 'Continuar para o painel guiado'}
            </button>
          </form>

          <button type="button" onClick={() => router.push('/eventos')} className="mt-4 w-full rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10">
            Pular tutorial e entrar direto
          </button>
        </div>
      </section>
    </main>
  );
}
