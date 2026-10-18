'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { readIntendedPlan } from '@/lib/billing/intended-plan';
import { formatMoney } from '@/lib/billing/plan-presentation';
import {
  Alert,
  BrandMark,
  JourneySteps,
  PublicBackground,
  PublicLoading,
  Spinner,
  inputClass,
  labelClass,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/components/public/PublicUI';
import { usePlanDetails } from '@/components/public/usePlanDetails';

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

  const { details: planDetails, name: planName } = usePlanDetails(intendedPlan);
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

  const businessLabel = BUSINESS_TYPES.find((type) => type.value === form.businessType)?.label || '';

  if (loading) {
    return <PublicLoading label="Preparando seu espaço..." />;
  }

  if (done) {
    return (
      <div className="relative min-h-[100dvh] overflow-hidden bg-slate-950 text-white">
        <PublicBackground />
        <header className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <BrandMark href="/dashboard" />
          <JourneySteps current={intendedPlan ? 'billing' : 'panel'} paidPlanName={intendedPlan ? planName : ''} />
        </header>
        <main className="relative z-10 mx-auto w-full max-w-xl px-4 pb-16 pt-6 md:pt-12">
          <section className={`p-6 text-center md:p-10 ${panelClass}`}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-emerald-500 text-3xl font-black text-slate-950 shadow-[0_18px_42px_rgba(16,185,129,0.35)]">✓</div>
            <h1 className="mt-6 text-3xl font-black tracking-[-0.04em] md:text-4xl">Seu espaço está pronto.</h1>
            <p className="mt-3 text-base leading-7 text-slate-300">
              {form.publicName.trim()} já pode organizar eventos, contratos e escalas. No painel você encontra um checklist curto
              para configurar o resto no seu ritmo.
            </p>
            {intendedPlan ? (
              <>
                <div className="mt-7 rounded-2xl border border-violet-300/30 bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-transparent p-5 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-violet-200">Último passo</p>
                      <p className="mt-1 text-xl font-black tracking-[-0.03em]">Assinatura do {planName}</p>
                    </div>
                    {planDetails ? (
                      <p className="text-right text-xl font-black tracking-[-0.03em]">
                        {formatMoney(planDetails.monthly_price)}
                        <span className="text-sm font-semibold text-slate-400">/mês</span>
                      </p>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Pix, boleto ou cartão. O plano é ativado assim que o pagamento é confirmado; até lá seu espaço funciona no Free.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/settings/billing?plan=${encodeURIComponent(intendedPlan)}`)}
                  className={`${primaryButtonClass} mt-6 w-full`}
                >
                  Concluir assinatura do {planName}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard?onboarding=ready')}
                  className={`${secondaryButtonClass} mt-3 w-full py-3`}
                >
                  Continuar no Free por enquanto
                </button>
              </>
            ) : (
              <>
                <ul className="mx-auto mt-7 max-w-sm space-y-2 text-left text-sm text-slate-300">
                  {['Cadastre seu primeiro evento', 'Envie um pré-contrato ao cliente', 'Convide sua equipe'].map((item) => (
                    <li key={item} className="flex gap-3 rounded-xl border border-white/8 bg-white/[0.04] px-4 py-2.5">
                      <span className="text-violet-200" aria-hidden="true">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard?onboarding=ready')}
                  className={`${primaryButtonClass} mt-7 w-full`}
                >
                  Ir para o painel
                </button>
              </>
            )}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-slate-950 text-white">
      <PublicBackground />
      <header className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <BrandMark href="/dashboard" />
        <JourneySteps current="workspace" paidPlanName={intendedPlan ? planName : ''} />
      </header>

      <main className="relative z-10 mx-auto grid grid-cols-1 w-full max-w-5xl items-start gap-8 px-4 pb-16 pt-4 md:px-6 md:pt-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-200">Configuração rápida · 1 minuto</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">Vamos configurar a sua operação.</h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-slate-300">
            Essas informações aparecem para seus clientes nos contratos e no portal. Dá para mudar depois em Configurações.
          </p>

          <form onSubmit={handleSubmit} className={`mt-7 space-y-6 p-5 md:p-7 ${panelClass}`}>
            <fieldset className="space-y-4">
              <legend className="mb-3 text-sm font-black text-white">Como seus clientes vão ver você</legend>
              <label className="block">
                <span className={labelClass}>Nome da banda ou do negócio *</span>
                <input value={form.publicName} onChange={(event) => updateField('publicName', event.target.value)} className={inputClass} placeholder="Ex: Banda Aurora" autoComplete="organization" required disabled={saving} />
              </label>
              <label className="block">
                <span className={labelClass}>Seu nome (responsável)</span>
                <input value={form.responsibleName} onChange={(event) => updateField('responsibleName', event.target.value)} className={inputClass} placeholder="Ex: Marina Souza" autoComplete="name" disabled={saving} />
              </label>
            </fieldset>

            <fieldset className="space-y-4 border-t border-white/10 pt-6">
              <legend className="mb-3 text-sm font-black text-white">Contato</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>WhatsApp</span>
                  <input value={form.supportWhatsapp} onChange={(event) => updateField('supportWhatsapp', event.target.value)} className={inputClass} placeholder="(71) 99999-9999" inputMode="tel" autoComplete="tel" disabled={saving} />
                </label>
                <label className="block">
                  <span className={labelClass}>Cidade</span>
                  <input value={form.city} onChange={(event) => updateField('city', event.target.value)} className={inputClass} placeholder="Ex: Salvador - BA" autoComplete="address-level2" disabled={saving} />
                </label>
              </div>
            </fieldset>

            <fieldset className="border-t border-white/10 pt-6">
              <legend className="mb-3 text-sm font-black text-white">Tipo de atuação</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Tipo de atuação">
                {BUSINESS_TYPES.map((type) => {
                  const selected = form.businessType === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => updateField('businessType', type.value)}
                      disabled={saving}
                      className={`rounded-2xl border px-3 py-3 text-left text-sm font-bold leading-5 transition ${
                        selected
                          ? 'border-violet-300/60 bg-violet-500/20 text-white'
                          : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {error ? <Alert tone="error">{error}</Alert> : null}

            <button type="submit" disabled={saving} className={`${primaryButtonClass} w-full`}>
              {saving ? (<><Spinner /> Salvando...</>) : intendedPlan ? 'Salvar e seguir para a assinatura' : 'Concluir configuração'}
            </button>
          </form>

          <Link href="/dashboard" className="mt-4 block w-full rounded-2xl px-5 py-3 text-center text-sm font-semibold text-slate-400 transition hover:text-white">
            Fazer depois
          </Link>
        </section>

        <aside className="lg:sticky lg:top-8" aria-label="Prévia">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Prévia para o cliente</p>
          <div className="rounded-[24px] border border-white/10 bg-white p-5 text-slate-900 shadow-[0_35px_120px_rgba(2,6,23,0.55)]">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-lg font-black text-white">
                {(form.publicName.trim() || 'H').charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-black tracking-[-0.02em]">{form.publicName.trim() || 'Nome da sua banda'}</p>
                <p className="truncate text-xs font-semibold text-slate-500">{[businessLabel, form.city.trim()].filter(Boolean).join(' · ') || 'Tipo de atuação · Cidade'}</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm">
              <p className="font-black">Pré-contrato do seu evento</p>
              <p className="mt-1 leading-6 text-slate-600">Preencha seus dados para reservarmos a data.</p>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Responsável</dt><dd className="truncate font-bold">{form.responsibleName.trim() || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">WhatsApp</dt><dd className="truncate font-bold">{form.supportWhatsapp.trim() || '—'}</dd></div>
            </dl>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Ilustração de como seus dados aparecem nas páginas que o cliente recebe.</p>
        </aside>
      </main>
    </div>
  );
}
