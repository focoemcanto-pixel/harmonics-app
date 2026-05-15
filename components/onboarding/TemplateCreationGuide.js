'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const GUIDE_STEPS = [
  {
    key: 'start',
    title: 'Comece criando o template',
    description: 'Clique em Novo template para abrir a área de criação do modelo-base do contrato.',
    targetTexts: ['Novo template', 'Novo / Editar'],
    fallbackSelector: '[data-tour="template-new-button"], button',
    actionLabel: 'Abrir criação',
  },
  {
    key: 'name',
    title: 'Dê um nome claro ao modelo',
    description: 'Use um nome operacional, como Contrato Casamento, Contrato Aniversário ou Contrato Corporativo.',
    targetTexts: ['Nome', 'Nome do template', 'Contrato padrão casamento'],
    fallbackSelector: '[data-tour="template-name-input"], input[placeholder*="Contrato padrão" i], input[placeholder*="nome" i]',
    actionLabel: 'Próximo',
  },
  {
    key: 'slug',
    title: 'Confira o identificador do template',
    description: 'O slug ajuda o sistema a identificar esse modelo de forma interna. Ele pode ser preenchido automaticamente pelo nome.',
    targetTexts: ['Slug', 'contrato-casamento-padrao'],
    fallbackSelector: '[data-tour="template-slug-input"], input[placeholder*="contrato-casamento" i]',
    actionLabel: 'Próximo',
  },
  {
    key: 'editor',
    title: 'Escreva ou cole o contrato',
    description: 'Cole o texto base do contrato como se fosse um documento manual. Depois você trocará os dados variáveis por tags automáticas.',
    targetTexts: ['Texto do contrato', 'Cole aqui o contrato'],
    fallbackSelector: '[data-tour="template-editor"], [data-contract-rich-editor="true"], [contenteditable="true"]',
    actionLabel: 'Próximo',
  },
  {
    key: 'dynamic_fields',
    title: 'Prepare os campos dinâmicos',
    description: 'Depois de inserir o texto, use este botão para transformar cliente, data, local, valor e assinatura em campos automáticos.',
    targetTexts: ['Preparar campos dinâmicos'],
    fallbackSelector: '[data-tour="template-dynamic-fields"], button',
    actionLabel: 'Continuar',
  },
  {
    key: 'save',
    title: 'Salve o template',
    description: 'Depois de revisar o texto e os campos automáticos, salve o template. Em seguida ele poderá ser associado aos tipos de evento.',
    targetTexts: ['Criar template', 'Salvar alterações', 'Salvar template'],
    fallbackSelector: '[data-tour="template-save-button"], button',
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

function isVisibleElement(element) {
  if (!element || typeof window === 'undefined') return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
}

function findByVisibleText(texts = []) {
  if (typeof document === 'undefined') return null;
  const candidates = texts.map(normalizeText).filter(Boolean);
  if (!candidates.length) return null;

  const elements = Array.from(document.querySelectorAll('button, a, label, input, textarea, [role="button"], [contenteditable="true"], p, h1, h2, h3, aside, section'));

  return elements.find((element) => {
    if (!isVisibleElement(element)) return false;
    const text = normalizeText(element.getAttribute('placeholder') || element.getAttribute('aria-label') || element.textContent || element.value || '');
    return candidates.some((candidate) => text.includes(candidate));
  }) || null;
}

function findBestButtonByText(texts = []) {
  if (typeof document === 'undefined') return null;
  const candidates = texts.map(normalizeText).filter(Boolean);
  const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
  return buttons.find((button) => {
    if (!isVisibleElement(button)) return false;
    const text = normalizeText(button.textContent || button.getAttribute('aria-label') || '');
    return candidates.some((candidate) => text.includes(candidate));
  }) || null;
}

function findTarget(step) {
  if (typeof document === 'undefined') return null;

  if (step.fallbackSelector) {
    const explicit = document.querySelector(step.fallbackSelector);
    if (explicit && isVisibleElement(explicit)) return explicit;
  }

  return findByVisibleText(step.targetTexts);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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

export default function TemplateCreationGuide({ enabled = false }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTemplateRoute = pathname === '/contratos/templates';
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [targetMissing, setTargetMissing] = useState(false);

  const step = GUIDE_STEPS[stepIndex];

  const sessionKey = useMemo(() => 'harmonics:template-creation-guide:session-v2', []);
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
    }

    const timer = window.setTimeout(() => setActive(true), 550);
    return () => window.clearTimeout(timer);
  }, [enabled, forceGuide, isTemplateRoute, sessionKey]);

  useEffect(() => {
    if (!active || !step || typeof window === 'undefined') return undefined;

    let retryTimer;

    function syncTarget() {
      const element = findTarget(step);

      if (!element) {
        setTargetRect(null);
        setTargetMissing(true);
        retryTimer = window.setTimeout(syncTarget, 450);
        return;
      }

      setTargetMissing(false);
      element.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'center' });

      window.setTimeout(() => {
        setTargetRect(element.getBoundingClientRect());
      }, 260);
    }

    syncTarget();
    window.addEventListener('resize', syncTarget);
    window.addEventListener('scroll', syncTarget, true);

    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    return () => {
      window.clearTimeout(retryTimer);
      window.removeEventListener('resize', syncTarget);
      window.removeEventListener('scroll', syncTarget, true);
      observer.disconnect();
    };
  }, [active, step]);

  if (!enabled || !isTemplateRoute || !active || !step) return null;

  function finishGuide() {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(sessionKey, 'skipped');
    }
    setActive(false);
  }

  function nextStep() {
    if (step.key === 'start') {
      const target = findTarget(step) || findBestButtonByText(['Novo template']);
      target?.click?.();
    }

    if (step.key === 'dynamic_fields') {
      const target = findTarget(step) || findBestButtonByText(['Preparar campos dinâmicos']);
      if (target && !targetMissing) target.click?.();
    }

    if (stepIndex >= GUIDE_STEPS.length - 1) {
      finishGuide();
      router.prefetch?.('/eventos/tipos');
      return;
    }

    setStepIndex((current) => current + 1);
  }

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 390;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const tooltipWidth = Math.min(450, viewportWidth - 32);
  const tooltipLeft = targetRect
    ? clamp(targetRect.left, 16, viewportWidth - tooltipWidth - 16)
    : 16;
  const tooltipTop = targetRect
    ? clamp(targetRect.bottom + 22, 16, viewportHeight - 380)
    : 120;

  const spotlightStyle = targetRect
    ? {
        left: Math.max(targetRect.left - 12, 8),
        top: Math.max(targetRect.top - 12, 8),
        width: targetRect.width + 24,
        height: targetRect.height + 24,
      }
    : null;

  const arrow = getArrowPosition(targetRect, tooltipTop, tooltipLeft, tooltipWidth);

  return (
    <div className="fixed inset-0 z-[260] pointer-events-none">
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" />

      {spotlightStyle ? (
        <div
          className="absolute rounded-[24px] border-2 border-white bg-white/5 shadow-[0_0_0_9999px_rgba(15,23,42,0.48),0_22px_80px_rgba(124,58,237,0.35)] transition-all duration-300"
          style={spotlightStyle}
        />
      ) : null}

      {targetRect && arrow ? (
        <div
          className={`absolute z-[262] text-[34px] font-black text-white drop-shadow-[0_10px_24px_rgba(0,0,0,0.38)] animate-bounce ${arrow.horizontal === 'left' ? '-rotate-45' : 'rotate-45'}`}
          style={{
            left: clamp(targetRect.left + targetRect.width / 2 - 16, 20, viewportWidth - 52),
            top: arrow.vertical === 'up'
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
        style={{ width: tooltipWidth, left: tooltipLeft, top: tooltipTop }}
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

        {targetMissing ? (
          <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-bold leading-5 text-amber-800">
            Estou aguardando essa área aparecer na tela. Avance para abrir o próximo ponto ou preencha o texto quando necessário.
          </div>
        ) : null}

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-violet-600 transition-all duration-300"
            style={{ width: `${Math.round(((stepIndex + 1) / GUIDE_STEPS.length) * 100)}%` }}
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
                onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
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
