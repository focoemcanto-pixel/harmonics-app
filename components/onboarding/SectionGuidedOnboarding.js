'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

const SECTION_GUIDES = {
  '/eventos': {
    key: 'events',
    eyebrow: 'Guia da seção',
    title: 'Vamos criar seu primeiro evento',
    description:
      'Esta é a central da operação. Comece cadastrando um evento teste para entender como contrato, escala, financeiro e repertório se conectam.',
    targetLabel: 'Começar pelo evento',
    targetSelector: '[data-guide-target="events-create"]',
    href: '/eventos',
    steps: [
      'Use o botão ou formulário de criação para cadastrar data, horário e local.',
      'Defina formação, valores e informações operacionais.',
      'Depois avance para pré-contrato ou escala do evento.',
    ],
  },
  '/pre-contratos': {
    key: 'precontracts',
    eyebrow: 'Guia da seção',
    title: 'Gere o primeiro link de pré-contrato',
    description:
      'Aqui você cria o link que o cliente recebe para preencher dados, revisar contrato, assinar e acessar o painel do cliente.',
    targetLabel: 'Gerar pré-contrato teste',
    targetSelector: '[data-guide-target="precontracts-create"]',
    href: '/pre-contratos',
    steps: [
      'Confira se existe template e tipo de evento configurados.',
      'Preencha os dados mínimos do cliente e do evento.',
      'Gere o link e abra para simular a experiência do cliente.',
    ],
  },
  '/contratos/templates': {
    key: 'contract-templates',
    eyebrow: 'Guia da seção',
    title: 'Configure o modelo usado nos contratos',
    description:
      'O template é o coração do contrato automático. Ele define o texto base e as tags que serão substituídas pelos dados do evento e do cliente.',
    targetLabel: 'Criar novo template',
    targetSelector: '[data-guide-target="contract-template-create"]',
    href: '/contratos/templates',
    steps: [
      'Clique em Novo template ou vá para a aba Novo / Editar.',
      'Monte o texto base com tags como cliente, data, local, valor e formação.',
      'Salve como ativo/default para usar nos próximos pré-contratos.',
    ],
  },
  '/automacoes/canais': {
    key: 'automation-channels',
    eyebrow: 'Guia da seção',
    title: 'Conecte o canal WhatsApp do workspace',
    description:
      'O canal libera automações, convites, lembretes e alertas. Comece conectando um provider e depois faça um envio de teste.',
    targetLabel: 'Conectar canal',
    targetSelector: '[data-guide-target="automation-channel-create"]',
    href: '/automacoes/canais',
    steps: [
      'Clique em Novo canal.',
      'Escolha o provider e preencha URL, token e instância.',
      'Salve e faça um teste antes de ativar automações reais.',
    ],
  },
};

function getGuideForPath(pathname) {
  const normalized = String(pathname || '').split('?')[0];
  return SECTION_GUIDES[normalized] || null;
}

function storageKeyForGuide(guide) {
  return `harmonics:section-guide:${guide?.key || 'unknown'}:v1`;
}

function getTargetRect(selector) {
  if (typeof document === 'undefined' || !selector) return null;
  const element = document.querySelector(selector);
  if (!element) return null;
  return element.getBoundingClientRect();
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
      return undefined;
    }

    const key = storageKeyForGuide(guide);
    const alreadySeen = window.localStorage.getItem(key) === 'done';
    if (alreadySeen) {
      setOpen(false);
      return undefined;
    }

    const timer = window.setTimeout(() => setOpen(true), 450);
    return () => window.clearTimeout(timer);
  }, [enabled, guide]);

  useEffect(() => {
    if (!open || !guide?.targetSelector || typeof window === 'undefined') return undefined;

    function updateTarget() {
      const element = document.querySelector(guide.targetSelector);
      if (!element) {
        setTargetRect(null);
        return;
      }

      element.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'center' });

      window.setTimeout(() => {
        setTargetRect(getTargetRect(guide.targetSelector));
      }, 280);
    }

    updateTarget();
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, true);

    return () => {
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
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
    ? clamp(targetRect.bottom + 18, 16, viewportHeight - 330)
    : Math.round(viewportHeight * 0.16);

  const spotlightStyle = targetRect
    ? {
        left: targetRect.left - 10,
        top: targetRect.top - 10,
        width: targetRect.width + 20,
        height: targetRect.height + 20,
      }
    : null;

  return (
    <section className="relative mb-5 overflow-hidden rounded-[32px] border border-violet-200 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.14),transparent_34%),linear-gradient(180deg,#ffffff_0%,#faf7ff_100%)] p-5 shadow-[0_18px_50px_rgba(124,58,237,0.10)] md:p-6">
      <div className="relative z-10 grid gap-5 lg:grid-cols-[1fr_360px] lg:items-center">
        <div>
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
        </div>

        <div className="rounded-[26px] border border-violet-200 bg-white/90 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">
            Faça assim
          </div>

          <div className="mt-3 space-y-3">
            {guide.steps.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[12px] font-black text-white">
                  {index + 1}
                </div>
                <p className="text-[13px] font-semibold leading-6 text-[#475569]">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[230] pointer-events-none">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" />
          {spotlightStyle ? (
            <div
              className="absolute rounded-[24px] border-2 border-white bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,0.48),0_22px_70px_rgba(124,58,237,0.30)] transition-all duration-300"
              style={spotlightStyle}
            />
          ) : null}

          <div
            className="pointer-events-auto absolute rounded-[28px] border border-violet-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.30)]"
            style={{ width: tooltipWidth, left: tooltipLeft, top: tooltipTop }}
          >
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">
              Continue o guia aqui
            </div>
            <h3 className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#0f172a]">
              {guide.title}
            </h3>
            <p className="mt-2 text-[14px] font-semibold leading-6 text-[#64748b]">
              {targetRect
                ? 'Este é o ponto de partida desta seção. Clique no item destacado e siga o fluxo guiado.'
                : 'Procure o botão ou aba principal desta seção para começar o fluxo guiado.'}
            </p>

            <div className="mt-4 rounded-[22px] border-2 border-violet-300 bg-violet-50 px-4 py-4 shadow-[0_12px_34px_rgba(124,58,237,0.18)]">
              <div className="text-[24px]">{targetRect ? '👆' : '↙️'}</div>
              <div className="mt-2 text-[15px] font-black text-violet-800">
                {guide.targetLabel}
              </div>
              <div className="mt-1 text-[12px] font-semibold leading-5 text-violet-700">
                {targetRect
                  ? 'O destaque mostra exatamente onde começar.'
                  : 'Se a tela tiver abas, entre em Novo / Editar ou clique no botão principal da seção.'}
              </div>
            </div>

            <div className="mt-5 flex justify-between gap-3">
              <button type="button" onClick={closeGuide} className="rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-[13px] font-black text-[#475569]">
                Pular esta seção
              </button>
              <button type="button" onClick={closeGuide} className="rounded-2xl bg-violet-600 px-4 py-2.5 text-[13px] font-black text-white">
                Entendi
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
