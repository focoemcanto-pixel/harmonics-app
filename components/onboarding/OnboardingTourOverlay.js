'use client';

import { useEffect, useMemo, useState } from 'react';
import { OPERATIONAL_ONBOARDING_TOUR } from '@/lib/onboarding/operationalTourRegistry';

const TOUR_STORAGE_KEY = 'harmonics:onboarding-tour:v1';

function getRect(selector) {
  if (typeof document === 'undefined') return null;
  const element = document.querySelector(selector);
  if (!element) return null;
  return element.getBoundingClientRect();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function OnboardingTourOverlay({ steps = OPERATIONAL_ONBOARDING_TOUR }) {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [snapshotKey, setSnapshotKey] = useState(0);

  const availableSteps = useMemo(() => {
    if (typeof document === 'undefined') return [];
    return steps.filter((step) => step?.selector && document.querySelector(step.selector));
  }, [steps, active, snapshotKey]);

  const current = availableSteps[index] || null;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const alreadySeen = window.localStorage.getItem(TOUR_STORAGE_KEY) === 'done';
    if (alreadySeen) return undefined;

    const timer = window.setTimeout(() => {
      setSnapshotKey((value) => value + 1);
      setActive(true);
    }, 900);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!active) return;
    if (availableSteps.length === 0) {
      setActive(false);
      return;
    }
    if (index > availableSteps.length - 1) {
      setIndex(availableSteps.length - 1);
    }
  }, [active, availableSteps.length, index]);

  useEffect(() => {
    if (!active || !current) return undefined;

    function updateRect() {
      const nextRect = getRect(current.selector);
      if (!nextRect) {
        setSnapshotKey((value) => value + 1);
        return;
      }
      setRect(nextRect);
    }

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    const element = document.querySelector(current.selector);
    element?.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'center' });

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [active, current]);

  function finishTour() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TOUR_STORAGE_KEY, 'done');
    }
    setActive(false);
  }

  function nextStep() {
    if (index >= availableSteps.length - 1) {
      finishTour();
      return;
    }
    setIndex((value) => value + 1);
  }

  function previousStep() {
    setIndex((value) => Math.max(0, value - 1));
  }

  if (!active || !current || !rect) return null;

  const padding = 10;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 390;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  const spotlightStyle = {
    left: rect.left - padding,
    top: rect.top - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };

  const tooltipWidth = Math.min(360, viewportWidth - 32);
  const tooltipLeft = clamp(rect.left, 16, viewportWidth - tooltipWidth - 16);
  const tooltipTop = current.placement === 'top'
    ? Math.max(16, rect.top - 230)
    : Math.min(viewportHeight - 240, rect.bottom + 20);

  return (
    <div className="fixed inset-0 z-[220] pointer-events-none">
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" />

      <div
        className="absolute rounded-[28px] border-2 border-white bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,0.55),0_20px_60px_rgba(124,58,237,0.28)] transition-all duration-300"
        style={spotlightStyle}
      />

      <div
        className="pointer-events-auto absolute rounded-[26px] border border-violet-200 bg-white p-5 shadow-[0_22px_70px_rgba(15,23,42,0.28)]"
        style={{ width: tooltipWidth, left: tooltipLeft, top: tooltipTop }}
      >
        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">
          Guia inicial {index + 1}/{availableSteps.length}
        </div>
        <h3 className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#0f172a]">
          {current.title}
        </h3>
        <p className="mt-2 text-[14px] font-semibold leading-6 text-[#64748b]">
          {current.description}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" onClick={finishTour} className="rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-[13px] font-black text-[#475569]">
            Pular
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={previousStep} disabled={index === 0} className="rounded-2xl border border-violet-200 bg-white px-4 py-2.5 text-[13px] font-black text-violet-700 disabled:opacity-40">
              Voltar
            </button>
            <button type="button" onClick={nextStep} className="rounded-2xl bg-violet-600 px-4 py-2.5 text-[13px] font-black text-white">
              {index >= availableSteps.length - 1 ? 'Concluir' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
