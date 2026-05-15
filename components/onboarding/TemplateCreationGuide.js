'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const GUIDE_STEPS = [
  {
    key: 'start',
    title: 'Comece criando o template',
    description: 'Clique em Novo template para abrir a área de criação do modelo-base do contrato.',
    targetTexts: ['Novo template', 'Novo / Editar'],
    fallbackSelector: '[data-tour="template-new-button"]',
    actionLabel: 'Abrir criação',
    autoAction: true,
  },
  {
    key: 'name',
    title: 'Dê um nome claro ao modelo',
    description: 'Use um nome operacional, como Contrato Casamento, Contrato Aniversário ou Contrato Corporativo.',
    targetTexts: ['Nome', 'Nome do template', 'Contrato padrão casamento'],
    fallbackSelector: '[data-tour="template-name-input"]',
    actionLabel: 'Próximo',
    validationMessage: 'Digite um nome para o template antes de avançar. Exemplo: Contrato Casamento Premium.',
    autoFocus: true,
  },
  {
    key: 'slug',
    title: 'Confira o identificador do template',
    description: 'O slug ajuda o sistema a identificar esse modelo de forma interna. Ele pode ser preenchido automaticamente pelo nome.',
    targetTexts: ['Slug', 'contrato-casamento-padrao'],
    fallbackSelector: '[data-tour="template-slug-input"]',
    actionLabel: 'Próximo',
    autoFocus: true,
  },
  {
    key: 'editor',
    title: 'Escreva ou cole o contrato',
    description: 'Cole o texto base do contrato como se fosse um documento manual. Depois você trocará os dados variáveis por tags automáticas.',
    targetTexts: ['Texto do contrato', 'Cole aqui o contrato'],
    fallbackSelector: '[data-tour="template-editor"]',
    actionLabel: 'Próximo',
    validationMessage: 'Cole ou escreva o texto do contrato antes de seguir para os campos dinâmicos.',
    autoFocus: true,
  },
  {
    key: 'dynamic_fields',
    title: 'Prepare os campos dinâmicos',
    description: 'Depois de inserir o texto, use este botão para transformar cliente, data, local, valor e assinatura em campos automáticos.',
    targetTexts: ['Preparar campos dinâmicos'],
    fallbackSelector: '[data-tour="template-dynamic-fields"]',
    actionLabel: 'Continuar',
    validationMessage: 'O botão de campos dinâmicos aparece depois que existe texto no contrato. Insira o texto para continuar.',
  },
  {
    key: 'save',
    title: 'Salve o template',
    description: 'Depois de revisar o texto e os campos automáticos, salve o template. Em seguida ele poderá ser associado aos tipos de evento.',
    targetTexts: ['Criar template', 'Salvar alterações', 'Salvar template'],
    fallbackSelector: '[data-tour="template-save-button"]',
    actionLabel: 'Finalizar guia',
  },
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function hasValue(element) {
  if (!element) return false;
  if ('value' in element) return String(element.value || '').trim().length > 0;
  return String(element.textContent || '').replace(/\u00a0/g, ' ').trim().length > 0;
}

function isFocusableElement(element) {
  if (!element) return false;
  const tag = String(element.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || element.isContentEditable || element.getAttribute('contenteditable') === 'true';
}

function focusTargetForStep(element) {
  if (!element || typeof window === 'undefined') return;

  const focusable = isFocusableElement(element)
    ? element
    : element.querySelector?.('input, textarea, [contenteditable="true"]');

  if (!focusable || !isFocusableElement(focusable)) return;

  window.setTimeout(() => {
    try {
      focusable.focus?.({ preventScroll: true });

      if ('select' in focusable && String(focusable.value || '').trim().length === 0) {
        focusable.select?.();
      }
    } catch (error) {
      console.warn('[TemplateCreationGuide] focus error', error);
    }
  }, 140);
}

function clearGuideQueryFromUrl() {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const hadGuide = url.searchParams.has('guide') || url.searchParams.has('onboarding');
  url.searchParams.delete('guide');
  url.searchParams.delete('onboarding');

  if (hadGuide) {
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }
}

function isVisibleElement(element) {
  if (!element || typeof window === 'undefined') return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
}

function findByVisibleText(texts = [], selector = 'button, a, label, input, textarea, [role="button"], [contenteditable="true"], p, h1, h2, h3, aside, section') {
  if (typeof document === 'undefined') return null;
  const candidates = texts.map(normalizeText).filter(Boolean);
  if (!candidates.length) return null;

  const elements = Array.from(document.querySelectorAll(selector));

  return elements.find((element) => {
    if (!isVisibleElement(element)) return false;
    const text = normalizeText(element.getAttribute('placeholder') || element.getAttribute('aria-label') || element.textContent || element.value || '');
    return candidates.some((candidate) => text.includes(candidate));
  }) || null;
}

function setTourAnchor(element, name) {
  if (!element || !name) return null;
  if (!element.getAttribute('data-tour')) {
    element.setAttribute('data-tour', name);
  }
  return element;
}

function findBestButtonByText(texts = []) {
  return findByVisibleText(texts, 'button, [role="button"]');
}

function ensureTemplateTourAnchors() {
  if (typeof document === 'undefined') return;

  setTourAnchor(findBestButtonByText(['Novo template']), 'template-new-button');

  const nameInput =
    document.querySelector('input[placeholder*="Contrato padrão" i]') ||
    findByVisibleText(['Nome'], 'label')?.querySelector?.('input');
  setTourAnchor(nameInput, 'template-name-input');

  const slugInput =
    document.querySelector('input[placeholder*="contrato-casamento" i]') ||
    findByVisibleText(['Slug'], 'label')?.querySelector?.('input');
  setTourAnchor(slugInput, 'template-slug-input');

  const editor =
    document.querySelector('[contenteditable="true"]') ||
    document.querySelector('[data-contract-rich-editor="true"]') ||
    findByVisibleText(['Texto do contrato'], 'label');
  setTourAnchor(editor, 'template-editor');

  setTourAnchor(findBestButtonByText(['Preparar campos dinâmicos']), 'template-dynamic-fields');
  setTourAnchor(findBestButtonByText(['Criar template', 'Salvar alterações', 'Salvar template']), 'template-save-button');
}

function findTarget(step) {
  if (typeof document === 'undefined') return null;

  ensureTemplateTourAnchors();

  if (step.fallbackSelector) {
    const explicit = document.querySelector(step.fallbackSelector);
    if (explicit && isVisibleElement(explicit)) return explicit;
  }

  return findByVisibleText(step.targetTexts);
}

function getStepValidationMessage(step) {
  if (!step) return '';

  if (step.key === 'name') {
    const nameInput = document.querySelector('[data-tour="template-name-input"]');
    return hasValue(nameInput) ? '' : step.validationMessage;
  }

  if (step.key === 'editor') {
    const editor = document.querySelector('[data-tour="template-editor"]');
    return hasValue(editor) ? '' : step.validationMessage;
  }

  if (step.key === 'dynamic_fields') {
    const button = document.querySelector('[data-tour="template-dynamic-fields"]');
    return button && isVisibleElement(button) ? '' : step.validationMessage;
  }

  return '';
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function shouldScrollTargetIntoView(rect) {
  if (!rect || typeof window === 'undefined') return false;
  const margin = 92;
  return rect.top < margin || rect.bottom > window.innerHeight - margin;
}

function getArrowPosition(targetRect, tooltipTop, tooltipLeft, tooltipWidth) {
  if (!targetRect) return null;

  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const tooltipCenterX = tooltipLeft + tooltipWidth / 2;
  const tooltipCenterY = tooltipTop + 120;

  const horizontal = targetCenterX < tooltipCenterX ? 'left' : 'right';
  const vertical = targetCenterY < tooltipCenterY ? 'up' : 'down';

  return { horizontal, vertical };
}

function getSpotlightBox(rect) {
  if (!rect) return null;
  const padding = 14;
  return {
    left: Math.max(rect.left - padding, 8),
    top: Math.max(rect.top - padding, 8),
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

function SpotlightMask({ box, viewportWidth, viewportHeight }) {
  const overlay = 'absolute bg-slate-950/62 backdrop-blur-[2px] transition-all duration-300';

  if (!box) {
    return <div className={`${overlay} inset-0`} />;
  }

  const rightWidth = Math.max(viewportWidth - (box.left + box.width), 0);
  const bottomHeight = Math.max(viewportHeight - (box.top + box.height), 0);

  return (
    <>
      <div className={overlay} style={{ left: 0, top: 0, width: '100%', height: box.top }} />
      <div className={overlay} style={{ left: 0, top: box.top, width: box.left, height: box.height }} />
      <div className={overlay} style={{ left: box.left + box.width, top: box.top, width: rightWidth, height: box.height }} />
      <div className={overlay} style={{ left: 0, top: box.top + box.height, width: '100%', height: bottomHeight }} />
    </>
  );
}

export default function TemplateCreationGuide({ enabled = false }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTemplateRoute = pathname === '/contratos/templates';

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [targetMissing, setTargetMissing] = useState(false);
  const [validationHint, setValidationHint] = useState('');

  const autoActionExecutedRef = useRef(false);
  const scrolledStepRef = useRef(null);
  const rectFrameRef = useRef(null);
  const lastRectRef = useRef(null);
  const focusedStepRef = useRef(null);

  const step = GUIDE_STEPS[stepIndex];

  const sessionKey = useMemo(() => 'harmonics:template-creation-guide:session-v9', []);
  const forceGuide = searchParams?.get('guide') === 'template' || searchParams?.get('onboarding') === 'template';

  useEffect(() => {
    if (!enabled || !isTemplateRoute || typeof window === 'undefined') {
      setActive(false);
      return;
    }

    const skippedThisSession = window.sessionStorage.getItem(sessionKey) === 'skipped';

    if (skippedThisSession && !forceGuide) return;

    if (forceGuide) {
      window.sessionStorage.removeItem(sessionKey);
      setStepIndex(0);
      autoActionExecutedRef.current = false;
      scrolledStepRef.current = null;
      focusedStepRef.current = null;
    }

    const timer = window.setTimeout(() => setActive(true), 550);

    return () => window.clearTimeout(timer);
  }, [enabled, forceGuide, isTemplateRoute, sessionKey]);

  useEffect(() => {
    if (!active || typeof window === 'undefined') return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [active]);

  useEffect(() => {
    if (!active || !step || typeof window === 'undefined') return undefined;

    let retryTimer;
    let mutationTimer;

    function updateRect(element) {
      if (!element) return;

      if (rectFrameRef.current) {
        window.cancelAnimationFrame(rectFrameRef.current);
      }

      rectFrameRef.current = window.requestAnimationFrame(() => {
        const nextRect = element.getBoundingClientRect();
        const previous = lastRectRef.current;
        const changed = !previous
          || Math.abs(previous.top - nextRect.top) > 2
          || Math.abs(previous.left - nextRect.left) > 2
          || Math.abs(previous.width - nextRect.width) > 2
          || Math.abs(previous.height - nextRect.height) > 2;

        if (changed) {
          lastRectRef.current = nextRect;
          setTargetRect(nextRect);
        }
      });
    }

    function syncTarget({ allowScroll = false } = {}) {
      ensureTemplateTourAnchors();
      setValidationHint('');
      const element = findTarget(step);

      if (!element) {
        setTargetRect(null);
        lastRectRef.current = null;
        setTargetMissing(true);

        retryTimer = window.setTimeout(() => syncTarget({ allowScroll: true }), 450);
        return;
      }

      setTargetMissing(false);

      const currentRect = element.getBoundingClientRect();
      const shouldScroll = allowScroll && scrolledStepRef.current !== step.key && shouldScrollTargetIntoView(currentRect);

      if (shouldScroll) {
        scrolledStepRef.current = step.key;
        element.scrollIntoView?.({
          behavior: 'auto',
          block: 'nearest',
          inline: 'nearest',
        });

        window.setTimeout(() => updateRect(element), 80);
      } else {
        updateRect(element);
      }

      if (step.autoFocus && focusedStepRef.current !== step.key) {
        focusedStepRef.current = step.key;
        focusTargetForStep(element);
      }

      if (step.autoAction && !autoActionExecutedRef.current) {
        autoActionExecutedRef.current = true;

        window.setTimeout(() => {
          try {
            element.click?.();

            window.setTimeout(() => {
              scrolledStepRef.current = null;
              lastRectRef.current = null;
              focusedStepRef.current = null;
              setStepIndex(1);
            }, 900);
          } catch (error) {
            console.error('[TemplateCreationGuide] autoAction error', error);
          }
        }, 650);
      }
    }

    syncTarget({ allowScroll: true });

    function handleResize() {
      syncTarget({ allowScroll: false });
    }

    window.addEventListener('resize', handleResize);

    const observer = new MutationObserver(() => {
      window.clearTimeout(mutationTimer);
      mutationTimer = window.setTimeout(() => syncTarget({ allowScroll: false }), 180);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      window.clearTimeout(retryTimer);
      window.clearTimeout(mutationTimer);
      if (rectFrameRef.current) window.cancelAnimationFrame(rectFrameRef.current);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [active, step]);

  if (!enabled || !isTemplateRoute || !active || !step) return null;

  function finishGuide() {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(sessionKey, 'skipped');
    }

    clearGuideQueryFromUrl();
    setActive(false);
  }

  function nextStep() {
    ensureTemplateTourAnchors();

    const message = getStepValidationMessage(step);
    if (message) {
      setValidationHint(message);
      return;
    }

    setValidationHint('');

    if (step.key === 'dynamic_fields') {
      const target = findTarget(step) || findBestButtonByText(['Preparar campos dinâmicos']);

      if (target && !targetMissing) {
        target.click?.();
      }
    }

    if (stepIndex >= GUIDE_STEPS.length - 1) {
      finishGuide();
      router.prefetch?.('/eventos/tipos');
      return;
    }

    scrolledStepRef.current = null;
    lastRectRef.current = null;
    focusedStepRef.current = null;
    setStepIndex((current) => current + 1);
  }

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 390;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  const tooltipWidth = Math.min(450, viewportWidth - 32);
  const spotlightBox = getSpotlightBox(targetRect);

  const tooltipLeft = targetRect
    ? clamp(targetRect.left, 16, viewportWidth - tooltipWidth - 16)
    : 16;

  const tooltipTop = targetRect
    ? clamp(targetRect.bottom + 22, 16, viewportHeight - 380)
    : 120;

  const arrow = getArrowPosition(targetRect, tooltipTop, tooltipLeft, tooltipWidth);

  return (
    <div className="fixed inset-0 z-[260] pointer-events-none">
      <SpotlightMask box={spotlightBox} viewportWidth={viewportWidth} viewportHeight={viewportHeight} />

      {spotlightBox ? (
        <div
          className="absolute rounded-[24px] border-2 border-white/95 bg-white/0 shadow-[0_0_0_2px_rgba(124,58,237,0.28),0_18px_70px_rgba(124,58,237,0.42)] ring-4 ring-violet-500/25 transition-all duration-300"
          style={{
            left: spotlightBox.left,
            top: spotlightBox.top,
            width: spotlightBox.width,
            height: spotlightBox.height,
          }}
        />
      ) : null}

      {targetRect && arrow ? (
        <div
          className={`absolute z-[262] text-[34px] font-black text-white drop-shadow-[0_10px_24px_rgba(0,0,0,0.38)] animate-bounce ${arrow.horizontal === 'left' ? '-rotate-45' : 'rotate-45'}`}
          style={{
            left: clamp(targetRect.left + targetRect.width / 2 - 16, 20, viewportWidth - 52),
            top:
              arrow.vertical === 'up'
                ? clamp(targetRect.bottom + 8, 20, viewportHeight - 60)
                : clamp(targetRect.top - 46, 20, viewportHeight - 60),
          }}
          aria-hidden="true"
        >
          ➜
        </div>
      ) : null}

      <div
        className="pointer-events-auto absolute rounded-[30px] border border-violet-200 bg-white p-5 shadow-[0_24px_90px_rgba(15,23,42,0.36)]"
        style={{
          width: tooltipWidth,
          left: tooltipLeft,
          top: tooltipTop,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">
            Guia de criação de contrato
          </div>

          <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black text-violet-700">
            {stepIndex + 1}/{GUIDE_STEPS.length}
          </span>
        </div>

        <h3 className="mt-3 text-[22px] font-black tracking-[-0.04em] text-[#0f172a]">
          {step.title}
        </h3>

        <p className="mt-2 text-[14px] font-semibold leading-7 text-[#64748b]">
          {step.description}
        </p>

        {(targetMissing || validationHint) ? (
          <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-bold leading-5 text-amber-800">
            {validationHint || 'Estou aguardando essa área aparecer na tela. Avance para abrir o próximo ponto ou preencha o texto quando necessário.'}
          </div>
        ) : null}

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-violet-600 transition-all duration-300"
            style={{
              width: `${Math.round(((stepIndex + 1) / GUIDE_STEPS.length) * 100)}%`,
            }}
          />
        </div>

        <div className="mt-5 flex flex-wrap justify-between gap-3">
          <button
            type="button"
            onClick={finishGuide}
            className="rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-[13px] font-black text-[#475569]"
          >
            Pular guia
          </button>

          <div className="flex gap-2">
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setValidationHint('');
                  scrolledStepRef.current = null;
                  lastRectRef.current = null;
                  focusedStepRef.current = null;
                  setStepIndex((current) => Math.max(0, current - 1));
                }}
                className="rounded-2xl border border-violet-200 bg-white px-4 py-2.5 text-[13px] font-black text-violet-700"
              >
                Voltar
              </button>
            ) : null}

            <button
              type="button"
              onClick={nextStep}
              className="rounded-2xl bg-violet-600 px-4 py-2.5 text-[13px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.28)]"
            >
              {step.actionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
