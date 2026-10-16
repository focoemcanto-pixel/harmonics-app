'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { readIntendedPlan } from '@/lib/billing/intended-plan';

// Passo essencial do onboarding único: só o que o produto precisa para funcionar.
// O restante vira checklist contextual no dashboard (fonte: /api/onboarding/flow-status).

const BUSINESS_TYPES = [
  { value: 'banda', label: 'Banda' },
  { value: 'orquestra', label: 'Orquestra / camerata' },
  { value: 'grupo_vocal', label: 'Grupo vocal / coral' },
  { value: 'musico_solo', label: 'Músico solo' },
  { value: 'dj', label: 'DJ' },
  { value: 'ministerio', label: 'Ministério de louvor' },
  { value: 'produtora', label: 'Produtora / agência' },
  { value: 'outro', label: 'Outro' },
];

function normalizePhone(value) {
  return String(value || '').replace(/\D+/g, '');
}

const inputClass =
  'w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-base text-white outline-none transition focus:border-emerald-300';

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [intendedPlan, setIntendedPlan] = useState('');

  useEffect(() => {
    setIntendedPlan(readIntendedPlan());
  }, []);
  const [error, setError] = useState('');
  const [workspace, setWorkspace] = useState(null);
  const [form, setForm] = useState({
    publicName: '',
    responsibleName: '',
    supportWhatsapp: '',
    city: '',
    businessType: 'banda',
  });

  useEffect(() => {
    let mounted = true;

    async function loadContext() {
      try {
        setLoading(true);
        setError('');

        if (!supabase) throw new Error('Supabase não está configurado.');

        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;
        const token = session?.access_token;

        if (!token) {
          router.replace('/login?next=/onboarding');
          return;
        }

        const response = await fetch('/api/workspace/current', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => null);

        if (response.status === 404) {
          router.replace('/workspace/new');
          return;
        }

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || 'Não foi possível carregar o workspace.');
        }

        if (!mounted) return;

        const resolvedWorkspace = payload.workspace || null;
        const settings = payload.settings || null;
        const profile = settings?.settings?.profile || {};

        setWorkspace(resolvedWorkspace);
        setForm((current) => ({
          ...current,
          publicName: settings?.public_name || settings?.company_name || resolvedWorkspace?.name || '',
          responsibleName: profile.responsible_name || session?.user?.user_metadata?.full_name || '',
          supportWhatsapp: settings?.support_whatsapp || settings?.admin_whatsapp || '',
          city: profile.city || '',
          businessType: profile.business_type || current.businessType,
        }));
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
    if (saving) return;

    if (!form.publicName.trim()) {
      setError('Informe o nome da banda ou do negócio.');
      return;
    }

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
          responsibleName: form.responsibleName.trim(),
          supportWhatsapp: normalizePhone(form.supportWhatsapp),
          city: form.city.trim(),
          businessType: form.businessType,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Não foi possível salvar.');
      }

      setDone(true);
    } catch (err) {
      setError(err?.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-6 text-white">
        <p className="text-sm text-slate-300">Preparando seu espaço...</p>
      </main>
    );
  }

  if (done) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4 py-10 text-white">
        <section className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 text-center shadow-2xl shadow-black/40 md:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-300 text-3xl text-slate-950">✓</div>
          <h1 className="mt-6 text-3xl font-black tracking-tight md:text-4xl">Seu espaço está pronto.</h1>
          <p className="mt-3 text-base leading-7 text-slate-300">
            {form.publicName.trim()} já pode organizar eventos, contratos e escalas. No painel você encontra um
            checklist curto para configurar o resto no seu ritmo.
          </p>
          {intendedPlan ? (
            <>
              <button
                type="button"
                onClick={() => router.push(`/settings/billing?plan=${encodeURIComponent(intendedPlan)}`)}
                className="mt-8 w-full rounded-2xl bg-emerald-300 px-5 py-4 font-black text-slate-950 transition hover:bg-emerald-200"
              >
                Concluir assinatura do plano escolhido
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard?onboarding=ready')}
                className="mt-3 w-full rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Continuar no Free por enquanto
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => router.push('/dashboard?onboarding=ready')}
              className="mt-8 w-full rounded-2xl bg-emerald-300 px-5 py-4 font-black text-slate-950 transition hover:bg-emerald-200"
            >
              Ir para o painel
            </button>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-slate-950 px-4 py-8 text-white md:py-14">
      <section className="mx-auto w-full max-w-lg">
        <p className="text-sm font-semibold text-emerald-200">Harmonics • 1 passo rápido</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">Conte um pouco sobre o seu negócio</h1>
        <p className="mt-3 text-base leading-7 text-slate-300">
          Essas informações aparecem para seus clientes nos contratos e no portal. Dá para mudar depois.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 md:p-7">
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Nome da banda ou do negócio *</span>
            <input value={form.publicName} onChange={(event) => updateField('publicName', event.target.value)} className={inputClass} placeholder="Ex: Banda Aurora" autoComplete="organization" required />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Seu nome (responsável)</span>
            <input value={form.responsibleName} onChange={(event) => updateField('responsibleName', event.target.value)} className={inputClass} placeholder="Ex: Marina Souza" autoComplete="name" />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">WhatsApp</span>
              <input value={form.supportWhatsapp} onChange={(event) => updateField('supportWhatsapp', event.target.value)} className={inputClass} placeholder="(71) 99999-9999" inputMode="tel" autoComplete="tel" />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Cidade</span>
              <input value={form.city} onChange={(event) => updateField('city', event.target.value)} className={inputClass} placeholder="Ex: Salvador - BA" autoComplete="address-level2" />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Tipo de atuação</span>
            <select value={form.businessType} onChange={(event) => updateField('businessType', event.target.value)} className={inputClass}>
              {BUSINESS_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </label>

          {error ? (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100" role="alert">
              {error}
            </div>
          ) : null}

          <button type="submit" disabled={saving} className="w-full rounded-2xl bg-emerald-300 px-5 py-4 font-black text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? 'Salvando...' : 'Concluir'}
          </button>
        </form>

        <Link href="/dashboard" className="mt-4 block w-full rounded-2xl border border-white/10 px-5 py-3 text-center text-sm font-medium text-slate-200 transition hover:bg-white/10">
          Fazer depois
        </Link>
      </section>
    </main>
  );
}
