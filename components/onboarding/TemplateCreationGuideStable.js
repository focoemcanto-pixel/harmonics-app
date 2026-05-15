'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const STEPS = [
  {
    key: 'start',
    title: 'Comece criando o template',
    description: 'Vou abrir a área de criação para você montar o modelo-base do contrato.',
    selector: '[data-tour="template-new-button"]',
    texts: ['Novo template', 'Criar template'],
    button: true,
    autoClick: true,
  },
  {
    key: 'name',
    title: 'Dê um nome claro ao modelo',
    description: 'Use um nome operacional. Exemplo: Contrato Casamento Premium. O identificador interno será gerado automaticamente a partir desse nome.',
    selector: '[data-tour="template-name-input"]',
    texts: ['Nome', 'Contrato padrão casamento'],
    requiresValue: true,
    hint: 'Digite um nome para o template antes de avançar.',
    focus: true,
  },
  {
    key: 'editor',
    title: 'Cole ou escreva o contrato',
    description: 'Insira o texto base do contrato. Depois você vai preparar os campos dinâmicos.',
    selector: '[data-tour="template-editor"]',
    texts: ['Texto do contrato', 'Cole aqui o contrato'],
    requiresValue: true,
    hint: 'Cole ou escreva o texto do contrato antes de avançar.',
    focus: true,
  },
  {
    key: 'dynamic_fields',
    title: 'Prepare os campos dinâmicos',
    description: 'Agora transforme cliente, data, local, valor e formação em campos automáticos.',
    selector: '[data-tour="template-dynamic-fields"]',
    texts: ['Preparar campos dinâmicos'],
    button: true,
    hint: 'Esse botão aparece depois que existe texto no contrato.',
  },
  {
    key: 'save',
    title: 'Salve o template',
    description: 'Depois de revisar o texto, salve. Em seguida, associe o template aos tipos de evento.',
    selector: '[data-tour="template-save-button"]',
    texts: ['Salvar template', 'Criar template', 'Salvar alterações'],
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
  const inputSelector = 'input, textarea, [contenteditable="true"]';

  setAnchor(findByText(['Novo template'], buttonSelector) || findByText(['Criar template'], buttonSelector), 'template-new-button');

  const formFields = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]')).filter(isVisible);
  const visibleInputs = formFields.filter((field) => {
    const placeholder = normalize(field.getAttribute?.('placeholder') || '');
    return !placeholder.includes('buscar por nome') && !placeholder.includes('buscar');
  });

  setAnchor(
    document.querySelector('input[placeholder*="Contrato padrão" i]') ||
      visibleInputs.find((field) => normalize(field.getAttribute?.('placeholder') || '').includes('contrato')) ||
      findByText(['Nome'], 'label')?.querySelector?.('input'),
    'template-name-input'
  );

  setAnchor(
    document.querySelector('[contenteditable="true"]') ||
      document.querySelector('[data-contract-rich-editor="true"]') ||
      findByText(['Texto do contrato'], inputSelector),
    'template-editor'
  );

  setAnchor(findByText(['Preparar campos dinâmicos'], buttonSelector), 'template-dynamic-fields');
  setAnchor(findByText(['Salvar template', 'Criar template', 'Salvar alterações'], buttonSelector), 'template-save-button');
}

function findTarget(step) {
  ensureAnchors();
  const explicit = document.querySelector(step.selector);
  if (explicit && isVisible(explicit)) return explicit;
  const selector = step.button ? 'button, [role="button"], a' : 'input, textarea, [contenteditable="true"], label, button, [role="button"]';
  return findByText(step.texts, selector);
}

function hasValue(el) {
  if (!el) return false;
  if ('value' in el) return String(el.value || '').trim().length > 0;
  return String(el.textContent || '').replace(/\u00a0/g, ' ').trim().length > 0;
}

function findFocusable(el) {
  if (!el) return null;
  const tag = String(el.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || el.isContentEditable) return el;
  return el.querySelector?.('input, textarea, [contenteditable="true"]') || null;
}

function clearGuideQuery() {
  const url = new URL(window.location.href);
  url.searchParams.delete('guide');
  url.searchParams.delete('onboarding');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getSpotlightBox(rect) {
  if (!rect) return null;
  const padding = 14;
  return {
    left: Math.max(8, rect.left - padding),
    top: Math.max(8, rect.top - padding),
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

function getDesiredCenterY(key, vh) {
  if (key === 'name') return vh * 0.46;
  if (key === 'editor') return vh * 0.43;
  return vh * 0.5;
}

function centerTargetComfortably(target, stepKey) {
  const rect = target.getBoundingClientRect();
  const desiredCenterY = getDesiredCenterY(stepKey, window.innerHeight);
  const currentCenterY = rect.top + rect.height / 2;
  const delta = currentCenterY - desiredCenterY;

  if (Math.abs(delta) < 56) return;

  const root = document.scrollingElement || document.documentElement;
  root.scrollTo({ top: root.scrollTop + delta, behavior: 'auto' });
}

function getTooltipPosition(rect, vw, vh, tooltipWidth, tooltipHeight = 300) {
  if (!rect) return { left: 16, top: 120 };

  const gap = 24;
  const spaceRight = vw - rect.right;
  const spaceLeft = rect.left;
  const canFitRight = spaceRight >= tooltipWidth + gap + 16;
  const canFitLeft = spaceLeft >= tooltipWidth + gap + 16;

  let left;
  if (canFitRight) {
    left = rect.right + gap;
  } else if (canFitLeft) {
    left = rect.left - tooltipWidth - gap;
  } else {
    left = clamp(rect.left + rect.width / 2 - tooltipWidth / 2, 16, vw - tooltipWidth - 16);
  }

  const targetCenterY = rect.top + rect.height / 2;
  let top = targetCenterY - tooltipHeight / 2;

  if (rect.bottom > vh * 0.68) {
    top = rect.top - tooltipHeight - gap;
  }

  if (top < 18) {
    top = rect.bottom + gap;
  }

  return {
    left: clamp(left, 16, vw - tooltipWidth - 16),
    top: clamp(top, 18, vh - tooltipHeight - 18),
  };
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

export default function TemplateCreationGuideStable({ enabled = false }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [hint, setHint] = useState('');
  const autoClickedRef = useRef(false);
  const focusedRef = useRef(null);
  const retryRef = useRef(null);
  const centeredStepRef = useRef(null);

  const step = STEPS[index];
  const shouldForce = searchParams?.get('guide') === 'template' || searchParams?.get('onboarding') === 'template';
  const sessionKey = useMemo(() => 'harmonics:template-guide-stable:v3', []);

  useEffect(() => {
    if (!enabled || pathname !== '/contratos/templates') return;
    if (!shouldForce && sessionStorage.getItem(sessionKey) === 'skipped') return;

    if (shouldForce) {
      sessionStorage.removeItem(sessionKey);
      autoClickedRef.current = false;
      focusedRef.current = null;
      centeredStepRef.current = null;
      setIndex(0);
    }

    const timer = setTimeout(() => setActive(true), 350);
    return () => clearTimeout(timer);
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

      if (center && centeredStepRef.current !== step.key) {
        centeredStepRef.current = step.key;
        centerTargetComfortably(target, step.key);
      }

      requestAnimationFrame(() => {
        setTargetRect(target.getBoundingClientRect());
      });

      if (step.focus && focusedRef.current !== step.key) {
        focusedRef.current = step.key;
        setTimeout(() => findFocusable(target)?.focus?.({ preventScroll: true }), 160);
      }

      if (step.autoClick && !autoClickedRef.current) {
        autoClickedRef.current = true;
        setTimeout(() => {
          target.click?.();
          setTimeout(() => {
            focusedRef.current = null;
            centeredStepRef.current = null;
            setIndex(1);
          }, 700);
        }, 550);
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

  if (!enabled || pathname !== '/contratos/templates' || !active || !step) return null;

  function finish() {
    sessionStorage.setItem(sessionKey, 'skipped');
    clearGuideQuery();
    setActive(false);
  }

  function next() {
    const target = findTarget(step);
    if (step.requiresValue && !hasValue(findFocusable(target) || target)) {
      setHint(step.hint || 'Preencha esta etapa antes de avançar.');
      findFocusable(target)?.focus?.({ preventScroll: true });
      return;
    }

    if (step.key === 'dynamic_fields' && target) target.click?.();

    setHint('');
    if (index >= STEPS.length - 1) return finish();
    focusedRef.current = null;
    centeredStepRef.current = null;
    setIndex((current) => current + 1);
  }

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const box = getSpotlightBox(targetRect);
  const tooltipWidth = Math.min(450, vw - 32);
  const tooltipPosition = getTooltipPosition(targetRect, vw, vh, tooltipWidth, hint ? 352 : 304);
  const arrowLeft = box ? clamp(box.left + box.width / 2 - 14, 18, vw - 44) : 18;
  const arrowTop = box ? clamp(box.top - 48, 18, vh - 58) : 80;

  return (
    <div className="fixed inset-0 z-[260] pointer-events-none">
      <Mask box={box} width={vw} height={vh} />

      {box ? (
        <div
          className="absolute rounded-[24px] border-2 border-white/95 bg-transparent shadow-[0_0_0_2px_rgba(124,58,237,0.30),0_18px_70px_rgba(124,58,237,0.44)] ring-4 ring-violet-500/25 transition-all duration-200"
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
        />
      ) : null}

      {box ? (
        <div className="absolute z-[262] animate-bounce text-[34px] font-black text-white drop-shadow-[0_10px_24px_rgba(0,0,0,0.40)]" style={{ left: arrowLeft, top: arrowTop }}>↓</div>
      ) : null}

      <div
        className="pointer-events-auto absolute rounded-[30px] border border-violet-200 bg-white p-5 shadow-[0_24px_90px_rgba(15,23,42,0.36)]"
        style={{ width: tooltipWidth, left: tooltipPosition.left, top: tooltipPosition.top }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">Guia de criação de contrato</div>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black text-violet-700">{index + 1}/{STEPS.length}</span>
        </div>

        <h3 className="mt-3 text-[22px] font-black tracking-[-0.04em] text-[#0f172a]">{step.title}</h3>
        <p className="mt-2 text-[14px] font-semibold leading-7 text-[#64748b]">{step.description}</p>

        {hint ? <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-bold leading-5 text-amber-800">{hint}</div> : null}

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-violet-600 transition-all duration-300" style={{ width: `${Math.round(((index + 1) / STEPS.length) * 100)}%` }} />
        </div>

        <div className="mt-5 flex flex-wrap justify-between gap-3">
          <button type="button" onClick={finish} className="rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-[13px] font-black text-[#475569]">Pular guia</button>

          <div className="flex gap-2">
            {index > 0 ? <button type="button" onClick={() => { setHint(''); focusedRef.current = null; centeredStepRef.current = null; setIndex((current) => Math.max(0, current - 1)); }} className="rounded-2xl border border-violet-200 bg-white px-4 py-2.5 text-[13px] font-black text-violet-700">Voltar</button> : null}
            <button type="button" onClick={next} className="rounded-2xl bg-violet-600 px-4 py-2.5 text-[13px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.28)]">{index >= STEPS.length - 1 ? 'Finalizar guia' : 'Próximo'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
