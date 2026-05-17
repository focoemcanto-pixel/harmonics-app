'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ONBOARDING_Z_INDEX, calculateOnboardingPopoverPosition } from '@/lib/onboarding/popoverPositioning';
import { useOnboardingSession } from '@/contexts/OnboardingSessionContext';

const GUIDE_ID = 'event-types';

const STEPS = [
  {
    key: 'start',
    title: 'Agora associe o template ao tipo de evento',
    description: 'O contrato só fica automático quando um tipo de evento usa esse template como modelo padrão.',
    targetTexts: ['Novo tipo', 'Criar tipo', 'Novo tipo de evento', 'Adicionar tipo'],
    selector: '[data-tour="event-type-new-button"]',
    button: true,
  },
  {
    key: 'name',
    title: 'Crie ou escolha um tipo de evento',
    description: 'Use um nome simples, como Casamento, Aniversário, Corporativo ou Chá revelação.',
    targetTexts: ['Nome', 'Tipo de evento', 'Casamento'],
    selector: '[data-tour="event-type-name-input"]',
    focus: true,
  },
  {
    key: 'template',
    title: 'Vincule o template padrão',
    description: 'Selecione o template que você acabou de criar. Assim todo pré-contrato desse tipo já nasce com o modelo correto.',
    targetTexts: ['Template', 'Contrato', 'Modelo'],
    selector: '[data-tour="event-type-template-select"]',
    focus: true,
  },
  {
    key: 'save',
    title: 'Salve a associação',
    description: 'Depois de salvar, o sistema já estará pronto para gerar o primeiro pré-contrato guiado.',
    targetTexts: ['Salvar', 'Criar tipo', 'Salvar tipo'],
    selector: '[data-tour="event-type-save-button"]',
    button: true,
  },
];

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}

function textOf(el) {
  return normalize(el?.getAttribute?.('placeholder') || el?.getAttribute?.('aria-label') || el?.textContent || el?.value || '');
}

function findByText(texts, selector) {
  const needles = (texts || []).map(normalize).filter(Boolean);
  if (!needles.length) return null;
  const elements = Array.from(document.querySelectorAll(selector));
  return elements.find((el) => isVisible(el) && needles.some((needle) => textOf(el).includes(needle))) || null;
}

function setAnchor(el, name) {
  if (el && name && !el.getAttribute('data-tour')) el.setAttribute('data-tour', name);
  return el;
}

function ensureAnchors() {
  const buttonSelector = 'button, [role="button"], a';
  const fieldSelector = 'input, textarea, select, [contenteditable="true"]';

  setAnchor(findByText(['Novo tipo', 'Criar tipo', 'Novo tipo de evento', 'Adicionar tipo'], buttonSelector), 'event-type-new-button');

  const fields = Array.from(document.querySelectorAll(fieldSelector)).filter(isVisible);
  const searchlessFields = fields.filter((field) => !normalize(field.getAttribute?.('placeholder') || '').includes('buscar'));

  setAnchor(
    document.querySelector('input[placeholder*="Casamento" i]') ||
      searchlessFields.find((field) => normalize(field.getAttribute?.('placeholder') || '').includes('tipo')) ||
      findByText(['Nome'], 'label')?.querySelector?.('input'),
    'event-type-name-input'
  );

  setAnchor(
    Array.from(document.querySelectorAll('select')).find((select) => isVisible(select) && /template|contrato|modelo/i.test(textOf(select) || select.closest('label')?.textContent || '')) ||
      findByText(['Template', 'Contrato', 'Modelo'], 'label')?.querySelector?.('select'),
    'event-type-template-select'
  );

  setAnchor(findByText(['Salvar', 'Criar tipo', 'Salvar tipo'], buttonSelector), 'event-type-save-button');
}

function findTarget(step) {
  ensureAnchors();
  const explicit = document.querySelector(step.selector);
  if (explicit && isVisible(explicit)) return explicit;
  const selector = step.button ? 'button, [role="button"], a' : 'input, textarea, select, [contenteditable="true"], label, button, [role="button"]';
  return findByText(step.targetTexts, selector);
}

function findFocusable(el) {
  if (!el) return null;
  const tag = String(el.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable) return el;
  return el.querySelector?.('input, textarea, select, [contenteditable="true"]') || null;
}

function getTemplateSelectValue() {
  const select = document.querySelector('[data-tour="event-type-template-select"]');
  return String(select?.value || '').trim();
}

function clearGuideQuery() {
  const url = new URL(window.location.href);
  url.searchParams.delete('guide');
  url.searchParams.delete('onboarding');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function getBox(rect) {
  if (!rect) return null;
  const padding = 14;
  return {
    left: Math.max(8, rect.left - padding),
    top: Math.max(8, rect.top - padding),
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

function centerTarget(target) {
  const rect = target.getBoundingClientRect();
  const desired = window.innerHeight * 0.45;
  const delta = rect.top + rect.height / 2 - desired;
  if (Math.abs(delta) < 56) return;
  const root = document.scrollingElement || document.documentElement;
  root.scrollTo({ top: root.scrollTop + delta, behavior: 'auto' });
}

function Mask({ box, width, height }) {
  const cls = 'absolute bg-slate-950/62 backdrop-blur-[2px] transition-all duration-200';
  if (!box) return <div className={`${cls} inset-0`} />;
  return (
    <>
      <div className={cls} style={{ left: 0, top: 0, width: '100%', height: box.top }} />
      <div className={cls} style={{ left: 0, top: box.top, width: box.left, height: box.height }} />
      <div className={cls} style={{ left: box.left + box.width, top: box.top, width: Math.max(width - box.left - box.width, 0), height: box.height }} />
      <div className={cls} style={{ left: 0, top: box.top + box.height, width: '100%', height: Math.max(height - box.top - box.height, 0) }} />
    </>
  );
}

export default function EventTypeTemplateGuideStable({ enabled = false }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { onboardingSession, startOnboardingSession, endOnboardingSession } = useOnboardingSession();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [popoverSize, setPopoverSize] = useState({ width: 430, height: 300 });
  const [validationMessage, setValidationMessage] = useState('');
  const retryRef = useRef(null);
  const popoverRef = useRef(null);
  const centeredRef = useRef(null);
  const focusedRef = useRef(null);
  const step = STEPS[index];
  const shouldForce = searchParams?.get('guide') === 'event-types' || searchParams?.get('onboarding') === 'event-types';
  const sessionKey = useMemo(() => 'harmonics:event-type-template-guide:v1', []);

  useEffect(() => {
    if (!active) return undefined;
    startOnboardingSession({ guide: GUIDE_ID, overlay: GUIDE_ID, mode: 'dynamic-guide' });
    return () => endOnboardingSession(GUIDE_ID);
  }, [active, endOnboardingSession, startOnboardingSession]);

  const isBlockedByAnotherOnboarding = Boolean((onboardingSession.activeGuide && onboardingSession.activeGuide !== GUIDE_ID) || (onboardingSession.activeOverlay && onboardingSession.activeOverlay !== GUIDE_ID));

  useEffect(() => {
    if (!enabled || pathname !== '/eventos/tipos') return;
    if (!shouldForce && sessionStorage.getItem(sessionKey) === 'skipped') return;
    let resetTimer;
    if (shouldForce) {
      sessionStorage.removeItem(sessionKey);
      resetTimer = setTimeout(() => setIndex(0), 0);
      centeredRef.current = null;
      focusedRef.current = null;
    }
    const timer = setTimeout(() => setActive(true), 350);
    return () => {
      clearTimeout(resetTimer);
      clearTimeout(timer);
    };
  }, [enabled, pathname, sessionKey, shouldForce]);

  useEffect(() => {
    if (!active || !step) return;

    function sync({ center = false } = {}) {
      const target = findTarget(step);
      if (!target) {
        setTargetRect(null);
        retryRef.current = setTimeout(() => sync({ center: true }), 450);
        return;
      }
      if (center && centeredRef.current !== step.key) {
        centeredRef.current = step.key;
        centerTarget(target);
      }
      requestAnimationFrame(() => setTargetRect(target.getBoundingClientRect()));
      if (step.focus && focusedRef.current !== step.key) {
        focusedRef.current = step.key;
        setTimeout(() => findFocusable(target)?.focus?.({ preventScroll: true }), 160);
      }
    }

    sync({ center: true });
    const onResize = () => sync({ center: false });
    window.addEventListener('resize', onResize);
    const observer = new MutationObserver(() => {
      clearTimeout(retryRef.current);
      retryRef.current = setTimeout(() => sync({ center: false }), 180);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    return () => {
      clearTimeout(retryRef.current);
      window.removeEventListener('resize', onResize);
      observer.disconnect();
    };
  }, [active, step]);


  useLayoutEffect(() => {
    if (!active || !popoverRef.current) return undefined;

    function syncPopoverSize() {
      const rect = popoverRef.current?.getBoundingClientRect();
      if (!rect?.width || !rect?.height) return;
      setPopoverSize((current) => {
        const next = { width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
        if (current.width === next.width && current.height === next.height) return current;
        return next;
      });
    }

    syncPopoverSize();
    const observer = new ResizeObserver(syncPopoverSize);
    observer.observe(popoverRef.current);
    return () => observer.disconnect();
  }, [active, index]);

  if (!enabled || pathname !== '/eventos/tipos' || !active || !step || isBlockedByAnotherOnboarding) return null;

  function finish() {
    sessionStorage.setItem(sessionKey, 'skipped');
    clearGuideQuery();
    window.location.assign('/pre-contratos?guide=precontract');
  }

  function next() {
    if (step?.key === 'template' && !getTemplateSelectValue()) {
      setValidationMessage('Selecione um template padrão para continuar o guia.');
      findFocusable(findTarget(step))?.focus?.({ preventScroll: true });
      return;
    }

    setValidationMessage('');
    if (index >= STEPS.length - 1) return finish();
    centeredRef.current = null;
    focusedRef.current = null;
    setIndex((current) => current + 1);
  }

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const box = getBox(targetRect);
  const tooltipWidth = Math.min(430, vw - 32);
  const tooltipPosition = calculateOnboardingPopoverPosition({
    targetRect,
    viewportWidth: vw,
    viewportHeight: vh,
    popoverWidth: tooltipWidth,
    popoverHeight: popoverSize.height,
    margin: vw < 640 ? 16 : 24,
    gap: 18,
  });

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: ONBOARDING_Z_INDEX.overlay }}>
      <Mask box={box} width={vw} height={vh} />
      {box ? <div className="absolute rounded-[24px] border-2 border-white bg-transparent shadow-[0_0_0_2px_rgba(124,58,237,0.30),0_18px_70px_rgba(124,58,237,0.44)] ring-4 ring-violet-500/25 transition-all duration-300 ease-out" style={{ zIndex: ONBOARDING_Z_INDEX.spotlight, left: box.left, top: box.top, width: box.width, height: box.height }} /> : null}
      <div
        ref={popoverRef}
        data-placement={tooltipPosition.placement}
        className="pointer-events-auto absolute rounded-[30px] border border-violet-200 bg-white p-5 shadow-[0_24px_90px_rgba(15,23,42,0.36)] transition-[left,top,transform] duration-300 ease-out will-change-[left,top]"
        style={{ zIndex: ONBOARDING_Z_INDEX.tooltip, width: tooltipWidth, left: tooltipPosition.left, top: tooltipPosition.top }}
      >
        {tooltipPosition.arrow ? (
          <span
            aria-hidden="true"
            className="absolute h-3 w-3 rotate-45 border-violet-200 bg-white"
            style={{ left: tooltipPosition.arrow.left, top: tooltipPosition.arrow.top }}
          />
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">Guia: tipo de evento</div>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black text-violet-700">{index + 1}/{STEPS.length}</span>
        </div>
        <h3 className="mt-3 text-[22px] font-black tracking-[-0.04em] text-[#0f172a]">{step.title}</h3>
        <p className="mt-2 text-[14px] font-semibold leading-7 text-[#64748b]">{step.description}</p>
        {validationMessage ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-black text-amber-800">
            {validationMessage}
          </div>
        ) : null}
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-violet-600 transition-all duration-300" style={{ width: `${Math.round(((index + 1) / STEPS.length) * 100)}%` }} />
        </div>
        <div className="mt-5 flex justify-between gap-3">
          <button type="button" onClick={() => { sessionStorage.setItem(sessionKey, 'skipped'); clearGuideQuery(); setActive(false); }} className="rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-[13px] font-black text-[#475569]">Pular guia</button>
          <button type="button" onClick={next} className="rounded-2xl bg-violet-600 px-4 py-2.5 text-[13px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.28)]">{index >= STEPS.length - 1 ? 'Ir para pré-contrato' : 'Próximo'}</button>
        </div>
      </div>
    </div>
  );
}
