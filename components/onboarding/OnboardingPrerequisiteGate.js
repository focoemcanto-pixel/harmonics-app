'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const STEP_COPY = {
  contract_template: {
    label: 'Template de contrato',
    title: 'Configure o primeiro template de contrato',
    description: 'O template é a base para vincular tipos de evento e gerar pré-contratos com dados consistentes.',
    primaryLabel: 'Criar template agora',
    href: '/contratos/templates?guide=template',
  },
  event_type: {
    label: 'Tipos de evento',
    title: 'Antes de criar tipos de evento, configure seu primeiro template de contrato.',
    description: 'Assim cada tipo de evento já nasce com um contrato padrão pronto para os próximos passos.',
    primaryLabel: 'Criar template agora',
    href: '/contratos/templates?guide=template',
  },
  precontract_template: {
    label: 'Pré-contrato',
    title: 'Antes de criar pré-contratos, configure seu primeiro template de contrato.',
    description: 'O pré-contrato precisa de um template para gerar a minuta e o link do cliente.',
    primaryLabel: 'Criar template agora',
    href: '/contratos/templates?guide=template',
  },
  precontract_event_type: {
    label: 'Pré-contrato',
    title: 'Antes de criar pré-contratos, configure seu primeiro tipo de evento.',
    description: 'O tipo de evento organiza a proposta e conecta o pré-contrato ao template correto.',
    primaryLabel: 'Criar tipo de evento agora',
    href: '/eventos/tipos?guide=event-types',
  },
};

function getBlockingStep(requiredStep, status) {
  if (!status) return null;
  if (requiredStep === 'event_type' && !status.hasContractTemplate) return 'event_type';
  if (requiredStep === 'precontract') {
    if (!status.hasContractTemplate) return 'precontract_template';
    if (!status.hasEventType) return 'precontract_event_type';
  }
  return null;
}

function clearGuideQuery() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('guide');
  url.searchParams.delete('onboarding');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export default function OnboardingPrerequisiteGate({
  requiredStep,
  children,
  enabled = true,
  blockOnlyForcedGuide = false,
}) {
  const router = useRouter();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;

    const controller = new AbortController();
    fetch('/api/onboarding/flow-status', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.error || 'Não foi possível validar os pré-requisitos do guia.');
        }
        setStatus(payload);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        console.warn('[ONBOARDING_PREREQUISITE_GATE][ERROR]', err?.message || err);
        setError(err?.message || 'Não foi possível validar os pré-requisitos do guia.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [enabled, requiredStep]);

  const blockingStep = useMemo(() => getBlockingStep(requiredStep, status), [requiredStep, status]);
  let fallbackBlockingStep = null;
  if (error && !status) {
    fallbackBlockingStep = requiredStep === 'precontract' ? 'precontract_template' : requiredStep;
  }
  const effectiveBlockingStep = blockingStep || fallbackBlockingStep;
  const copy = effectiveBlockingStep ? STEP_COPY[effectiveBlockingStep] : null;
  const shouldBlock = Boolean(enabled && effectiveBlockingStep && !dismissed && (!blockOnlyForcedGuide || status || error));

  function navigateToRequiredStep() {
    const href = copy?.href || status?.nextHref || '/contratos/templates?guide=template';
    router.push(href);
  }

  function continueWithoutGuide() {
    setDismissed(true);
    clearGuideQuery();
  }

  if (!enabled) return children || null;
  if (!shouldBlock && !loading) return children || null;
  if (!shouldBlock && loading) return null;

  return (
    <div className="fixed inset-0 z-[280] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-[2px]">
      <div className="w-full max-w-[520px] rounded-[32px] border border-violet-100 bg-white p-6 shadow-[0_30px_100px_rgba(15,23,42,0.36)]">
        <div className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">
          Guia dinâmico · {copy?.label || 'Onboarding'}
        </div>
        <h2 className="mt-4 text-[26px] font-black leading-tight tracking-[-0.05em] text-[#0f172a]">
          {copy?.title || 'Existe uma etapa anterior no onboarding.'}
        </h2>
        <p className="mt-3 text-[14px] font-semibold leading-7 text-[#64748b]">
          {copy?.description || 'Siga a ordem recomendada para que os próximos guias usem dados reais deste workspace.'}
        </p>
        {error ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-bold leading-5 text-amber-800">
            {error}
          </div>
        ) : null}
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] font-bold leading-6 text-slate-600">
          Fluxo recomendado: boas-vindas → template de contrato → tipos de evento → pré-contrato → demais módulos.
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={continueWithoutGuide}
            className="rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-[13px] font-black text-[#475569]"
          >
            Continuar sem guia
          </button>
          <button
            type="button"
            onClick={navigateToRequiredStep}
            className="rounded-2xl bg-violet-600 px-4 py-2.5 text-[13px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.28)]"
          >
            {copy?.primaryLabel || 'Ir para etapa anterior'}
          </button>
        </div>
      </div>
    </div>
  );
}
