'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { OPERATIONAL_ONBOARDING_TOUR } from '@/lib/onboarding/operationalTourRegistry';
import { ONBOARDING_Z_INDEX, calculateOnboardingPopoverPosition } from '@/lib/onboarding/popoverPositioning';

const TOUR_STORAGE_KEY = 'harmonics:onboarding-tour:v1';

function getRect(selector) {
  if (typeof document === 'undefined') return null;
  const element = document.querySelector(selector);
  if (!element) return null;
  return element.getBoundingClientRect();
}

export default function OnboardingTourOverlay({
  steps = OPERATIONAL_ONBOARDING_TOUR,
  force = false,
  storageKey = TOUR_STORAGE_KEY,
  onFinishHref = null,
  finalLabel = 'Concluir',
  onFinish = null,
}) {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [snapshotKey, setSnapshotKey] = useState(0);
  const [popoverSize, setPopoverSize] = useState({ width: 360, height: 260 });
  const popoverRef = useRef(null);
  const resolvedStorageKey = String(storageKey || TOUR_STORAGE_KEY);

  const availableSteps = useMemo(() => {
    if (typeof document === 'undefined') return [];
    return steps.filter((step) => step?.selector && document.querySelector(step.selector));
  }, [steps, active, snapshotKey]);

  const current = availableSteps[index] || null;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    setActive(false);
    setRect(null);
    setIndex(0);

    const alreadySeen = window.localStorage.getItem(resolvedStorageKey) === 'done';
    if (alreadySeen && !force) return undefined;

    const timer = window.setTimeout(() => {
      setSnapshotKey((value) => value + 1);
      setActive(true);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [force, resolvedStorageKey]);

  useEffect(() => {
    if (!active) return;
    if (availableSteps.length === 0) {
      const timer = window.setTimeout(() => setActive(false), 0);
      return () => window.clearTimeout(timer);
    }
    if (index > availableSteps.length - 1) {
      const timer = window.setTimeout(() => setIndex(availableSteps.length - 1), 0);
      return () => window.clearTimeout(timer);
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
      window.localStorage.setItem(resolvedStorageKey, 'done');
    }
    if (typeof onFinish === 'function') {
      onFinish();
      return;
    }
    if (typeof window !== 'undefined' && onFinishHref) {
      window.location.assign(onFinishHref);
      return;
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


  useLayoutEffect(() => {
    if (!active || !popoverRef.current) return undefined;

    function syncPopoverSize() {
      const measured = popoverRef.current?.getBoundingClientRect();
      if (!measured?.width || !measured?.height) return;
      setPopoverSize((current) => {
        const next = { width: Math.ceil(measured.width), height: Math.ceil(measured.height) };
        if (current.width === next.width && current.height === next.height) return current;
        return next;
      });
    }

    syncPopoverSize();
    const observer = new ResizeObserver(syncPopoverSize);
    observer.observe(popoverRef.current);
    return () => observer.disconnect();
  }, [active, index]);

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
  const preferredPlacements = current.placement === 'top'
    ? ['top', 'right', 'left', 'bottom']
    : ['right', 'left', 'bottom', 'top'];
  const tooltipPosition = calculateOnboardingPopoverPosition({
    targetRect: rect,
    viewportWidth,
    viewportHeight,
    popoverWidth: tooltipWidth,
    popoverHeight: popoverSize.height,
    margin: viewportWidth < 640 ? 16 : 24,
    gap: 18,
    preferredPlacements,
  });

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: ONBOARDING_Z_INDEX.overlay }}>
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" />

      <div
        className="absolute rounded-[28px] border-2 border-white bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,0.55),0_20px_60px_rgba(124,58,237,0.28)] transition-all duration-300 ease-out"
        style={{ zIndex: ONBOARDING_Z_INDEX.spotlight, ...spotlightStyle }}
      />

      <div
        ref={popoverRef}
        data-placement={tooltipPosition.placement}
        className="pointer-events-auto absolute rounded-[26px] border border-violet-200 bg-white p-5 shadow-[0_22px_70px_rgba(15,23,42,0.28)] transition-[left,top,transform] duration-300 ease-out will-change-[left,top]"
        style={{ zIndex: ONBOARDING_Z_INDEX.tooltip, width: tooltipWidth, left: tooltipPosition.left, top: tooltipPosition.top }}
      >
        {tooltipPosition.arrow ? (
          <span
            aria-hidden="true"
            className="absolute h-3 w-3 rotate-45 border-violet-200 bg-white"
            style={{ left: tooltipPosition.arrow.left, top: tooltipPosition.arrow.top }}
          />
        ) : null}
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
              {index >= availableSteps.length - 1 ? finalLabel : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
