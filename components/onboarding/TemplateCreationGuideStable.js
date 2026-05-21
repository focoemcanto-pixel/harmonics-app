'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useOnboardingSession } from '@/contexts/OnboardingSessionContext';

const GUIDE_ID = 'template';
const NEXT_HREF = '/eventos/tipos?guide=event-types';

const STEPS = [
  ['Crie o primeiro template', 'Clique em Novo template e abra o formulário de criação.'],
  ['Nomeie o modelo', 'Use um nome claro, como Contrato padrão casamento.'],
  ['Preencha o texto', 'Cole ou escreva o texto base do contrato.'],
  ['Salve e avance', 'Depois de salvar, vamos vincular o template a um tipo de evento.'],
];

function clearGuideQuery() {
  const url = new URL(window.location.href);
  url.searchParams.delete('guide');
  url.searchParams.delete('onboarding');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export default function TemplateCreationGuideStable({ enabled = false }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { onboardingSession, startOnboardingSession, endOnboardingSession } = useOnboardingSession();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const forced = searchParams?.get('guide') === GUIDE_ID || searchParams?.get('onboarding') === GUIDE_ID;
  const blocked = Boolean(
    (onboardingSession.activeGuide && onboardingSession.activeGuide !== GUIDE_ID) ||
    (onboardingSession.activeOverlay && onboardingSession.activeOverlay !== GUIDE_ID)
  );

  useEffect(() => {
    if (!enabled || pathname !== '/contratos/templates' || !forced) return undefined;
    const timer = setTimeout(() => {
      setActive(true);
      startOnboardingSession({ guide: GUIDE_ID, overlay: GUIDE_ID, mode: 'template-guide' });
    }, 200);
    return () => {
      clearTimeout(timer);
      endOnboardingSession(GUIDE_ID);
    };
  }, [enabled, endOnboardingSession, forced, pathname, startOnboardingSession]);

  if (!enabled || pathname !== '/contratos/templates' || !forced || !active || blocked) return null;

  const [title, description] = STEPS[stepIndex] || STEPS[0];

  function skip() {
    clearGuideQuery();
    endOnboardingSession(GUIDE_ID);
    setActive(false);
  }

  function next() {
    if (stepIndex >= STEPS.length - 1) {
      clearGuideQuery();
      endOnboardingSession(GUIDE_ID);
      router.push(NEXT_HREF);
      return;
    }
    setStepIndex((current) => current + 1);
  }

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/65 px-4 backdrop-blur-[2px]">
      <section className="w-full max-w-xl rounded-[32px] border border-violet-200 bg-white p-6 shadow-[0_30px_100px_rgba(15,23,42,0.38)] md:p-7">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">Guia: template</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">{stepIndex + 1}/{STEPS.length}</span>
        </div>
        <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.05em] text-slate-950">{title}</h2>
        <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">{description}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button type="button" onClick={skip} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600">Pular guia</button>
          <button type="button" onClick={next} className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-[0_16px_36px_rgba(124,58,237,0.28)]">{stepIndex >= STEPS.length - 1 ? 'Ir para tipos de evento' : 'Continuar'}</button>
        </div>
      </section>
    </div>
  );
}
