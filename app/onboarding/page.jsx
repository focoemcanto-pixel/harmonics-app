'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

function normalizePhone(value) {
  return String(value || '').replace(/\D+/g, '');
}

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

      router.push('/eventos');
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
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-6 py-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <div className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">
            Workspace criado com sucesso
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
              Agora vamos deixar sua operação com a sua cara.
            </h1>
            <p className="max-w-xl text-lg leading-8 text-slate-300">
              Configure a identidade básica do seu workspace. Depois você poderá ajustar automações, equipe, contratos e canais de WhatsApp no painel.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
            <p className="font-medium text-white">Plano atual</p>
            <p className="mt-1">Você começou no plano Free. Upgrade e integrações de cobrança entrarão na próxima etapa do SaaS.</p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/40 backdrop-blur md:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">Configuração inicial</h2>
            <p className="mt-2 text-sm text-slate-300">
              Workspace: <span className="text-white">{workspace?.name || 'Novo workspace'}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Nome público</span>
              <input
                value={form.publicName}
                onChange={(event) => updateField('publicName', event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                placeholder="Ex: Harmonics Eventos"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-slate-300">WhatsApp de suporte/admin</span>
              <input
                value={form.supportWhatsapp}
                onChange={(event) => updateField('supportWhatsapp', event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                placeholder="Ex: 71999999999"
                inputMode="tel"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Cor principal</span>
              <div className="flex gap-3">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(event) => updateField('primaryColor', event.target.value)}
                  className="h-12 w-16 rounded-2xl border border-white/10 bg-slate-900 p-1"
                />
                <input
                  value={form.primaryColor}
                  onChange={(event) => updateField('primaryColor', event.target.value)}
                  className="flex-1 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-emerald-300"
                />
              </div>
            </label>

            {error ? (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-2xl bg-emerald-300 px-5 py-4 font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Concluir e entrar no painel'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => router.push('/eventos')}
            className="mt-4 w-full rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Pular por enquanto
          </button>
        </div>
      </section>
    </main>
  );
}
