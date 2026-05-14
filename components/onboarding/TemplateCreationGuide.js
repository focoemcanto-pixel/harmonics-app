'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const GUIDE_STEPS = [
  {
    key: 'start',
    title: 'Comece criando o template',
    description: 'Clique em Novo template ou na aba Novo / Editar para abrir a área de criação do modelo-base.',
    targetTexts: ['Novo template', 'Novo / Editar'],
    fallbackSelector: '[data-guide-target="contract-template-create"]',
    actionLabel: 'Abrir criação',
  },
  {
    key: 'name',
    title: 'Dê um nome claro ao modelo',
    description: 'Use um nome operacional, como Contrato Casamento, Contrato Aniversário ou Contrato Corporativo.',
    targetTexts: ['Nome', 'Nome do template', 'Título'],
    fallbackSelector: 'input[name="name"], input[placeholder*="nome" i]',
    actionLabel: 'Entendi',
  },
  {
    key: 'editor',
    title: 'Escreva o contrato normalmente',
    description: 'Cole ou escreva o texto base como se fosse um contrato manual. Depois substitua os dados variáveis por tags.',
    targetTexts: ['Cole aqui o contrato', 'Texto do contrato'],
    fallbackSelector: '[data-contract-rich-editor="true"], [contenteditable="true"]',
    actionLabel: 'Próximo',
  },
  {
    key: 'tags',
    title: 'Use tags nos dados variáveis',
    description: 'Substitua nome do cliente, data, local, valor e assinatura por tags como {{cliente_nome}}, {{evento_data}} e {{valor_total}}.',
    targetTexts: ['Assistente de contrato', 'Tags', '{{cliente_nome}}'],
    fallbackSelector: '[data-contract-assistant="true"], aside',
    actionLabel: 'Ver exemplo',
  },
  {
    key: 'preview',
    title: 'Confira o preview vivo',
    description: 'Abra a aba Preview no assistente para ver o contrato preenchido com dados fictícios antes de salvar.',
    targetTexts: ['Preview'],
    fallbackSelector: '[data-contract-preview="true"]',
    actionLabel: 'Conferir preview',
  },
  {
    key: 'save',
    title: 'Salve como modelo ativo',
    description: 'Depois de revisar tags e preview, salve o template. Em seguida, associe esse modelo a um tipo de evento.',
    targetTexts: ['Salvar template', 'Salvar', 'Criar template'],
    fallbackSelector: 'button[type="submit"]',
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

  const elements = Array.from(document.querySelectorAll('button, a, label, input, textarea, [role="button"], [contenteditable="true"], p, h1, h2, h3, aside'));

  return elements.find((element) => {
    if (!isVisibleElement(element)) return false;
    const text = normalizeText(element.getAttribute('placeholder') || element.getAttribute('aria-label') || element.textContent || element.value || '');
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

export default function TemplateCreationGuide({ enabled = false }) {
  const pathname = usePathname();
  const router = useRouter();
  const isTemplateRoute = pathname === '/contratos/templates';
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  const step = GUIDE_STEPS[stepIndex];

  const storageKey = useMemo(() => 'harmonics:template-creation-guide:v1', []);

  useEffect(() => {
    if (!enabled || !isTemplateRoute || typeof window === 'undefined') {
      setActive(false);
      return;
    }

    const alreadyDone = window.localStorage.getItem(storageKey) === 'done';
    if (alreadyDone) return;

    const timer = window.setTimeout(() => setActive(true), 700);
    return () => window.clearTimeout(timer);
  }, [enabled, isTemplateRoute, storageKey]);

  useEffect(() => {
    if (!active || !step || typeof window === 'undefined') return undefined;

    function syncTarget() {
      const element = findTarget(step);

      if (!element) {
        setTargetRect(null);
        return;
      }

      element.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'center' });

      window.setTimeout(() => {
        setTargetRect(element.getBoundingClientRect());
      }, 250);
    }

    syncTarget();
    window.addEventListener('resize', syncTarget);
    window.addEventListener('scroll', syncTarget, true);

    return () => {
      window.removeEventListener('resize', syncTarget);
      window.removeEventListener('scroll', syncTarget, true);
    };
  }, [active, step]);

  if (!enabled || !isTemplateRoute || !active || !step) return null;

  function finishGuide() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, 'done');
    }
    setActive(false);
  }

  function nextStep() {
    if (step.key === 'start') {
      const target = findTarget(step);
      target?.click?.();
    }

    if (step.key === 'tags') {
      const assistantButton = Array.from(document.querySelectorAll('button')).find((button) => normalizeText(button.textContent).includes('assistente'));
      assistantButton?.click?.();
    }

    if (step.key === 'preview') {
      const previewButton = Array.from(document.querySelectorAll('button')).find((button) => normalizeText(button.textContent).includes('preview'));
      previewButton?.click?.();
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
  const tooltipWidth = Math.min(430, viewportWidth - 32);
  const tooltipLeft = targetRect
    ? clamp(targetRect.left, 16, viewportWidth - tooltipWidth - 16)
    : 16;
  const tooltipTop = targetRect
    ? clamp(targetRect.bottom + 18, 16, viewportHeight - 360)
    : 120;

  const spotlightStyle = targetRect
    ? {
        left: targetRect.left - 10,
        top: targetRect.top - 10,
        width: targetRect.width + 20,
        height: targetRect.height + 20,
      }
    : null;

  return (
    <div className="fixed inset-0 z-[260] pointer-events-none">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" />

      {spotlightStyle ? (
        <div
          className="absolute rounded-[24px] border-2 border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.50),0_22px_80px_rgba(124,58,237,0.35)] transition-all duration-300"
          style={spotlightStyle}
        />
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

        {!targetRect ? (
          <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-bold leading-5 text-amber-800">
            Ainda não encontrei o alvo visual nesta tela. Use o botão abaixo para avançar e abrir a área correspondente.
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
