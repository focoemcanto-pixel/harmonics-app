// upgraded version with automatic target discovery by visible text and selector
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

const SECTION_GUIDES = {
  '/eventos': {
    key: 'events',
    eyebrow: 'Guia da seção',
    title: 'Vamos criar seu primeiro evento',
    description: 'Esta é a central da operação. Comece cadastrando um evento teste para entender como contrato, escala, financeiro e repertório se conectam.',
    targetLabel: 'Novo evento',
    targetSelector: '[data-guide-target="events-create"]',
    targetText: ['Novo evento', 'Criar evento', 'Adicionar evento'],
    href: '/eventos',
    steps: ['Cadastre nome, data e local.', 'Defina formação e operação.', 'Depois siga para contrato ou escala.'],
  },
  '/pre-contratos': {
    key: 'precontracts',
    eyebrow: 'Guia da seção',
    title: 'Gere o primeiro pré-contrato',
    description: 'Aqui você cria o link que o cliente recebe para preencher e assinar.',
    targetLabel: 'Gerar pré-contrato',
    targetSelector: '[data-guide-target="precontracts-create"]',
    targetText: ['Gerar pré-contrato', 'Novo pré-contrato', 'Gerar link'],
    href: '/pre-contratos',
    steps: ['Preencha os dados do cliente.', 'Defina evento e valores.', 'Gere o link e teste o fluxo.'],
  },
  '/contratos/templates': {
    key: 'templates',
    eyebrow: 'Guia da seção',
    title: 'Configure seu template base',
    description: 'O template controla todo o texto dos contratos automáticos.',
    targetLabel: 'Novo template',
    targetSelector: '[data-guide-target="contract-template-create"]',
    targetText: ['Novo template', 'Novo / Editar'],
    href: '/contratos/templates',
    steps: ['Crie o texto base.', 'Configure tags dinâmicas.', 'Salve como padrão.'],
  },
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getGuideForPath(pathname) {
  return SECTION_GUIDES[String(pathname || '').split('?')[0]] || null;
}

function storageKeyForGuide(guide) {
  return `harmonics:section-guide:${guide?.key || 'unknown'}:v2`;
}

function isVisibleElement(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
}

function findTargetElement(guide) {
  if (typeof document === 'undefined' || !guide) return null;

  if (guide.targetSelector) {
    const explicit = document.querySelector(guide.targetSelector);
    if (explicit && isVisibleElement(explicit)) return explicit;
  }

  const normalizedCandidates = (guide.targetText || []).map(normalizeText);

  const elements = Array.from(document.querySelectorAll('button, a, [role="button"]'));

  return elements.find((element) => {
    if (!isVisibleElement(element)) return false;
    const text = normalizeText(element.textContent || element.getAttribute('aria-label') || '');
    return normalizedCandidates.some((candidate) => text.includes(candidate));
  }) || null;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function SectionGuidedOnboarding({ enabled = false }) {
  const pathname = usePathname();
  const guide = useMemo(() => getGuideForPath(pathname), [pathname]);
  const [open, setOpen] = useState(false);
  const [targetRect, setTargetRect] = useState(null);

  useEffect(() => {
    if (!enabled || !guide || typeof window === 'undefined') {
      setOpen(false);
      return;
    }

    const alreadySeen = window.localStorage.getItem(storageKeyForGuide(guide)) === 'done';
    if (alreadySeen) {
      setOpen(false);
      return;
    }

    const timer = window.setTimeout(() => setOpen(true), 500);
    return () => window.clearTimeout(timer);
  }, [enabled, guide]);

  useEffect(() => {
    if (!open || !guide || typeof window === 'undefined') return;

    function syncTarget() {
      const element = findTargetElement(guide);

      if (!element) {
        setTargetRect(null);
        return;
      }

      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      window.setTimeout(() => {
        setTargetRect(element.getBoundingClientRect());
      }, 260);
    }

    syncTarget();

    window.addEventListener('resize', syncTarget);
    window.addEventListener('scroll', syncTarget, true);

    return () => {
      window.removeEventListener('resize', syncTarget);
      window.removeEventListener('scroll', syncTarget, true);
    };
  }, [guide, open]);

  if (!enabled || !guide) return null;

  function closeGuide() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKeyForGuide(guide), 'done');
    }
    setOpen(false);
  }

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 390;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  const tooltipWidth = Math.min(420, viewportWidth - 32);

  const tooltipLeft = targetRect
    ? clamp(targetRect.left, 16, viewportWidth - tooltipWidth - 16)
    : 16;

  const tooltipTop = targetRect
    ? clamp(targetRect.bottom + 18, 16, viewportHeight - 340)
    : 120;

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-[230] pointer-events-none">
          <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" />

          {targetRect ? (
            <div
              className="absolute rounded-[24px] border-2 border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.48),0_22px_70px_rgba(124,58,237,0.35)] transition-all duration-300"
              style={{
                left: targetRect.left - 10,
                top: targetRect.top - 10,
                width: targetRect.width + 20,
                height: targetRect.height + 20,
              }}
            />
          ) : null}

          <div
            className="pointer-events-auto absolute rounded-[28px] border border-violet-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.35)]"
            style={{ width: tooltipWidth, left: tooltipLeft, top: tooltipTop }}
          >
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">
              Continue o onboarding
            </div>

            <h3 className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#0f172a]">
              {guide.title}
            </h3>

            <p className="mt-2 text-[14px] font-semibold leading-6 text-[#64748b]">
              {targetRect
                ? 'O sistema encontrou exatamente onde você deve começar.'
                : 'Procure o botão principal desta tela para continuar.'}
            </p>

            <div className="mt-4 rounded-[22px] border-2 border-violet-300 bg-violet-50 px-4 py-4">
              <div className="text-[24px]">{targetRect ? '👆' : '↙️'}</div>
              <div className="mt-2 text-[15px] font-black text-violet-800">
                {guide.targetLabel}
              </div>
            </div>

            <div className="mt-5 flex justify-between gap-3">
              <button
                type="button"
                onClick={closeGuide}
                className="rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-[13px] font-black text-[#475569]"
              >
                Pular
              </button>

              <button
                type="button"
                onClick={closeGuide}
                className="rounded-2xl bg-violet-600 px-4 py-2.5 text-[13px] font-black text-white"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="relative mb-5 overflow-hidden rounded-[32px] border border-violet-200 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.14),transparent_34%),linear-gradient(180deg,#ffffff_0%,#faf7ff_100%)] p-5 shadow-[0_18px_50px_rgba(124,58,237,0.10)] md:p-6">
        <div className="inline-flex rounded-full border border-violet-200 bg-violet-100/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">
          {guide.eyebrow}
        </div>

        <h2 className="mt-3 text-[26px] font-black tracking-[-0.05em] text-[#0f172a] md:text-[34px]">
          {guide.title}
        </h2>

        <p className="mt-3 max-w-2xl text-[14px] font-semibold leading-7 text-[#64748b]">
          {guide.description}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={guide.href}
            className="rounded-[20px] bg-violet-600 px-5 py-3 text-[14px] font-black text-white shadow-[0_14px_34px_rgba(124,58,237,0.28)]"
          >
            {guide.targetLabel}
          </Link>

          <button
            type="button"
            onClick={closeGuide}
            className="rounded-[20px] border border-violet-200 bg-white px-5 py-3 text-[14px] font-black text-violet-700"
          >
            Já entendi
          </button>
        </div>
      </section>
    </>
  );
}
