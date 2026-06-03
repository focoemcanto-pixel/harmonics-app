'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { useHasActiveGuide } from '@/contexts/OnboardingSessionContext';
import { getNextOnboardingStep } from '@/lib/onboarding/getNextOnboardingStep';

const OPERATIONAL_SHORTCUTS = [
  {
    label: 'Criar evento',
    href: '/eventos',
    tourKey: 'create-first-event',
    description: 'Comece cadastrando uma cerimônia, evento ou apresentação.',
  },
  {
    label: 'Gerar pré-contrato',
    href: '/pre-contratos?guide=precontract',
    tourKey: 'create-first-precontract',
    description: 'Envie um link para o cliente preencher e assinar.',
  },
  {
    label: 'Configurar template',
    href: '/contratos/templates?guide=template',
    tourKey: 'contract-template',
    description: 'Monte o modelo usado nos contratos automáticos.',
  },
];

export default function DashboardOnboardingBanner() {
  const isGuideActive = useHasActiveGuide();
  const supabase = useMemo(() => getSupabase(), []);
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [skipping, setSkipping] = useState(false);
  const [hidden, setHidden] = useState(false);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  }

  async function loadProgress() {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch('/api/onboarding/flow-status', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data?.ok) setPayload(data);
    } finally {
      setLoading(false);
    }
  }

  async function skipOnboarding() {
    if (skipping) return;
    setSkipping(true);

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch('/api/onboarding/flow-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ flowState: { skipped: true, onboarding_skipped: true }, completed: true }),
      });

      if (response.ok) setHidden(true);
    } finally {
      setSkipping(false);
    }
  }

  useEffect(() => {
    if (isGuideActive) {
      setPayload(null);
      setLoading(false);
      return undefined;
    }

    let active = true;

    async function run() {
      if (!active) return;
      await loadProgress();
    }

    run();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuideActive]);

  if (isGuideActive || loading || hidden) return null;
  if (!payload?.ok) return null;
  if (payload.completed === true || payload.skipped === true || payload.primaryWorkspace === true) return null;

  const freshWorkspace = searchParams?.get('onboarding') === 'fresh-workspace' || searchParams?.get('tour') === 'workspace-created';
  const { nextStep, summary } = getNextOnboardingStep(payload);
  if (!nextStep) return null;

  const nextHref = payload.nextHref || nextStep.href || '/settings/onboarding';
  const chips = [nextStep, payload.upcomingStep ? { key: payload.upcomingStep, title: 'Próxima etapa' } : null].filter(Boolean);

  return (
    <section data-onboarding-tour="dashboard-banner" className="rounded-[30px] border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-fuchsia-50 p-5 shadow-[0_14px_34px_rgba(124,58,237,0.10)] md:p-6">
      <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
        <div>
          <div className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-violet-700">
            Onboarding
          </div>

          <h2 className="mt-3 text-[24px] font-black tracking-[-0.04em] text-[#0f172a] md:text-[30px]">
            Finalize a configuração do seu workspace
          </h2>

          <p className="mt-2 text-[14px] font-semibold leading-6 text-[#64748b]">
            {freshWorkspace
              ? 'Conheça as abas principais do dashboard e siga para o primeiro guia prático do fluxo oficial.'
              : `Você concluiu ${summary.completed} de ${summary.total} etapas. Continue o onboarding dinâmico para finalizar a configuração real do Harmonics.`}
          </p>

          {chips.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {chips.map((step) => (
                <span key={step.key} className="rounded-full border border-violet-200 bg-white px-3 py-1 text-[12px] font-black text-violet-700">
                  {step.title}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {OPERATIONAL_SHORTCUTS.map((shortcut) => (
              <Link
                key={shortcut.tourKey}
                data-onboarding-tour={shortcut.tourKey}
                href={shortcut.href}
                className="rounded-[22px] border border-violet-200 bg-white/85 p-4 shadow-[0_10px_26px_rgba(124,58,237,0.08)] transition hover:-translate-y-0.5 hover:bg-white"
              >
                <div className="text-[14px] font-black text-violet-800">{shortcut.label}</div>
                <div className="mt-1 text-[12px] font-semibold leading-5 text-[#64748b]">{shortcut.description}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-violet-200 bg-white p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.12em] text-violet-700">Configuração inicial</div>
              <div className="mt-1 text-[34px] font-black tracking-[-0.06em] text-violet-950">{summary.percentage}%</div>
            </div>
            <div className="pb-2 text-[13px] font-black text-violet-700">{summary.completed}/{summary.total}</div>
          </div>

          <div className="mt-2 h-3 overflow-hidden rounded-full bg-violet-100">
            <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${summary.percentage || 0}%` }} />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Link data-onboarding-tour="onboarding-link" href={freshWorkspace ? '/contratos/templates?guide=template' : nextHref} className="rounded-2xl bg-violet-600 px-4 py-3 text-center text-[13px] font-black text-white hover:bg-violet-500">
              Continuar
            </Link>
            <button type="button" onClick={skipOnboarding} disabled={skipping} className="rounded-2xl border border-violet-200 bg-white px-4 py-3 text-center text-[13px] font-black text-violet-700 hover:bg-violet-50 disabled:opacity-60">
              {skipping ? 'Pulando...' : 'Pular'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
