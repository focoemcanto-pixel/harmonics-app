'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useOnboardingSession } from '@/contexts/OnboardingSessionContext';

const GUIDE_ID = 'template';
const NEXT_HREF = '/eventos/tipos?guide=event-types';

const STEPS = [
  {
    title: 'Crie o primeiro template',
    description: 'Clique em Novo template para abrir o formulário de criação.',
    selector: '[data-tour="template-new-button"]',
  },
  {
    title: 'Nomeie o modelo',
    description: 'Use um nome claro, como Contrato padrão casamento.',
    selector: '[data-tour="template-name-input"]',
  },
  {
    title: 'Preencha o texto',
    description: 'Cole ou escreva o texto base do contrato no editor.',
    selector: '[data-tour="template-editor"]',
  },
  {
    title: 'Salve e avance',
    description: 'Depois de salvar, vamos vincular o template a um tipo de evento.',
    selector: '[data-tour="template-save-button"]',
  },
];

function clearGuideQuery() {
  const url = new URL(window.location.href);
  url.searchParams.delete('guide');
  url.searchParams.delete('onboarding');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function visible(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
}

function findTarget(step) {
  if (!step?.selector) return null;
  const candidates = Array.from(document.querySelectorAll(step.selector));
  return candidates.find(visible) || null;
}

function boxFromElement(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  const padding = 12;
  return {
    left: Math.max(8, rect.left - padding),
    top: Math.max(8, rect.top - padding),
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

function popoverPosition(box) {
  const width = typeof window === 'undefined' ? 420 : Math.min(420, window.innerWidth - 32);
  if (typeof window === 'undefined' || !box) return { width, left: 16, top: 24 };
  if (window.innerWidth < 768) {
    const nearTop = box?.top < window.innerHeight * 0.45;
    return {
      width,
      left: 16,
      top: nearTop ? Math.max(16, (box?.top || 0) + (box?.height || 0) + 12) : 16,
      bottom: nearTop ? undefined : 16,
    };
  }

  const gap = 22;
  const rightLeft = box.left + box.width + gap;
  const fitsRight = rightLeft + width < window.innerWidth - 16;
  const left = fitsRight ? rightLeft : Math.max(16, box.left - width - gap);
  const top = Math.min(Math.max(18, box.top), window.innerHeight - 290);
  return { width, left, top, bottom: undefined };
}

export default function TemplateCreationGuideStable({ enabled = false }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { onboardingSession, startOnboardingSession, endOnboardingSession } = useOnboardingSession();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [box, setBox] = useState(null);

  const forced = searchParams?.get('guide') === GUIDE_ID || searchParams?.get('onboarding') === GUIDE_ID;
  const blocked = Boolean(
    (onboardingSession.activeGuide && onboardingSession.activeGuide !== GUIDE_ID) ||
    (onboardingSession.activeOverlay && onboardingSession.activeOverlay !== GUIDE_ID)
  );

  useEffect(() => {
    if (!enabled || pathname !== '/contratos/templates' || !forced) return undefined;
    const timer = setTimeout(() => {
      setActive(true);
      startOnboardingSession({ guide: GUIDE_ID, overlay: GUIDE_ID, mode: 'template-dynamic-guide' });
    }, 200);
    return () => {
      clearTimeout(timer);
      endOnboardingSession(GUIDE_ID);
    };
  }, [enabled, endOnboardingSession, forced, pathname, startOnboardingSession]);

  useEffect(() => {
    if (!active) return undefined;

    function sync() {
      const target = findTarget(STEPS[stepIndex]);
      if (!target) {
        setBox(null);
        return;
      }
      target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
      requestAnimationFrame(() => setBox(boxFromElement(target)));
    }

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
    };
  }, [active, stepIndex]);

  if (!enabled || pathname !== '/contratos/templates' || !forced || !active || blocked) return null;

  const step = STEPS[stepIndex] || STEPS[0];
  const popover = popoverPosition(box);

  function skip() {
    clearGuideQuery();
    endOnboardingSession(GUIDE_ID);
    setActive(false);
  }

  function next() {
    if (stepIndex === 0) {
      const formCard = findTarget({ selector: '[data-tour="template-form-card"]' });
      if (!formCard) {
        const newButton = findTarget({ selector: '[data-tour="template-new-button"]' });
        newButton?.click?.();
      }
    }

    if (stepIndex >= STEPS.length - 1) {
      clearGuideQuery();
      endOnboardingSession(GUIDE_ID);
      router.push(NEXT_HREF);
      return;
    }
    setStepIndex((current) => current + 1);
  }

  return (
    <div className="fixed inset-0 z-[260] pointer-events-none">
      {box ? (
        <>
          <div className="absolute bg-slate-950/55" style={{ left: 0, top: 0, width: '100%', height: box.top }} />
          <div className="absolute bg-slate-950/55" style={{ left: 0, top: box.top, width: box.left, height: box.height }} />
          <div className="absolute bg-slate-950/55" style={{ left: box.left + box.width, top: box.top, right: 0, height: box.height }} />
          <div className="absolute bg-slate-950/55" style={{ left: 0, top: box.top + box.height, width: '100%', bottom: 0 }} />
        </>
      ) : (
        <div className="absolute inset-0 bg-slate-950/55" />
      )}
      {box ? (
        <div
          className="absolute rounded-[22px] border-2 border-violet-400 bg-transparent shadow-[0_0_0_1px_rgba(255,255,255,0.5),0_20px_70px_rgba(124,58,237,0.38)] ring-4 ring-violet-500/35"
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
        />
      ) : null}
      <section
        className="pointer-events-auto absolute rounded-[28px] border border-violet-200 bg-white p-5 shadow-[0_24px_90px_rgba(15,23,42,0.36)]"
        style={{ width: popover.width, left: popover.left, top: popover.top, bottom: popover.bottom }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">Guia: template</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">{stepIndex + 1}/{STEPS.length}</span>
        </div>
        <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-slate-950">{step.title}</h2>
        <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">{step.description}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button type="button" onClick={skip} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600">Pular guia</button>
          <button type="button" onClick={next} className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-[0_16px_36px_rgba(124,58,237,0.28)]">{stepIndex >= STEPS.length - 1 ? 'Ir para tipos de evento' : 'Continuar'}</button>
        </div>
      </section>
    </div>
  );
}
