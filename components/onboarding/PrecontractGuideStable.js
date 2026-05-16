'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const STEPS = [
  {
    key: 'event_type',
    title: 'Escolha o tipo de evento',
    description: 'Comece selecionando o tipo configurado antes. Ele define o template padrão que será usado no contrato.',
    texts: ['tipo de evento', 'event_type', 'casamento'],
    selector: 'select, input, button, label',
  },
  {
    key: 'event_date',
    title: 'Informe data e horário do evento',
    description: 'Esses campos entram diretamente no contrato e ajudam o cliente a conferir as informações principais antes de assinar.',
    texts: ['data do evento', 'event_date', 'data', 'horário', 'hora'],
    selector: 'input, label, button',
  },
  {
    key: 'formation_value',
    title: 'Defina formação e valor',
    description: 'Preencha a formação musical e o valor acertado. Esses são dados essenciais do pré-contrato.',
    texts: ['formação', 'formation', 'valor acertado', 'valor', 'agreed_amount'],
    selector: 'input, select, label, button',
  },
  {
    key: 'optional_client',
    title: 'Dados do cliente são opcionais aqui',
    description: 'Nome, WhatsApp, e-mail, local e endereço podem ser deixados para o cliente preencher no link público. Preencha aqui apenas se já tiver certeza.',
    texts: ['nome do cliente', 'cliente', 'whatsapp', 'e-mail', 'email', 'local', 'endereço'],
    selector: 'input, textarea, label',
  },
  {
    key: 'preview',
    title: 'Veja o preview antes de salvar',
    description: 'Antes de finalizar, abra a prévia para conferir se o contrato está puxando o template, valores, data, formação e campos automáticos corretamente.',
    texts: ['preview', 'visualizar', 'prévia', 'ver contrato', 'visualização'],
    selector: 'button, a, [role="button"]',
  },
  {
    key: 'edit_contract_optional',
    title: 'Edição do contrato é opcional',
    description: 'Se precisar ajustar alguma cláusula só neste contrato, use a opção de editar o contrato aqui. Se o template estiver certo, pode seguir sem mexer.',
    texts: ['editar contrato', 'contrato personalizado', 'personalizar contrato', 'customizar contrato', 'editar modelo'],
    selector: 'button, a, label, input, [role="button"]',
  },
  {
    key: 'save',
    title: 'Finalize o pré-contrato',
    description: 'Agora salve ou gere o link. O sistema criará o pré-contrato e abrirá o compartilhamento para envio ao cliente.',
    texts: ['salvar', 'gerar link', 'criar pré-contrato', 'finalizar', 'salvar pré-contrato'],
    selector: 'button, [role="button"]',
  },
  {
    key: 'copy_link',
    title: 'Copie o link do contrato',
    description: 'Depois de salvar, copie o link para enviar ao cliente pelo WhatsApp ou outro canal.',
    texts: ['copiar link', 'link do contrato', 'contrato salvo', 'link pronto'],
    selector: 'button, a, textarea, div',
    waitsForShareModal: true,
  },
  {
    key: 'open_contract',
    title: 'Abra o contrato em outra aba',
    description: 'Abra o link para visualizar a experiência do cliente e conferir se tudo está correto antes de enviar.',
    texts: ['abrir whatsapp', 'abrir painel do cliente', 'abrir contrato', 'link do contrato'],
    selector: 'button, a, div',
    waitsForShareModal: true,
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
  if (!el || typeof window === 'undefined') return false;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}

function textOf(el) {
  if (!el) return '';
  const labelText = el.closest?.('label')?.textContent || '';
  return normalize([
    el.getAttribute?.('data-tour'),
    el.getAttribute?.('placeholder'),
    el.getAttribute?.('aria-label'),
    el.name,
    el.id,
    el.value,
    el.textContent,
    labelText,
  ].filter(Boolean).join(' '));
}

function findByTexts(texts, selector) {
  const needles = (texts || []).map(normalize).filter(Boolean);
  const elements = Array.from(document.querySelectorAll(selector || 'input, select, textarea, button, a, label, [role="button"]'));

  return elements.find((el) => {
    if (!isVisible(el)) return false;
    const text = textOf(el);
    return needles.some((needle) => text.includes(needle));
  }) || null;
}

function findTarget(step) {
  if (step.waitsForShareModal) {
    const modalTarget = findByTexts(step.texts, step.selector);
    if (modalTarget) return modalTarget;
  }

  return findByTexts(step.texts, step.selector);
}

function findFocusable(el) {
  if (!el) return null;
  const tag = String(el.tagName || '').toLowerCase();
  if (['input', 'textarea', 'select', 'button', 'a'].includes(tag) || el.isContentEditable) return el;
  return el.querySelector?.('input, textarea, select, button, a, [contenteditable="true"]') || null;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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
  const desiredY = window.innerHeight * 0.44;
  const delta = rect.top + rect.height / 2 - desiredY;
  if (Math.abs(delta) < 60) return;
  const root = document.scrollingElement || document.documentElement;
  root.scrollTo({ top: root.scrollTop + delta, behavior: 'auto' });
}

function clearGuideQuery() {
  const url = new URL(window.location.href);
  url.searchParams.delete('guide');
  url.searchParams.delete('onboarding');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
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

export default function PrecontractGuideStable({ enabled = false }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [missing, setMissing] = useState(false);
  const retryRef = useRef(null);
  const centeredRef = useRef(null);
  const focusedRef = useRef(null);

  const step = STEPS[index];
  const shouldForce = searchParams?.get('guide') === 'precontract' || searchParams?.get('onboarding') === 'precontract';
  const sessionKey = useMemo(() => 'harmonics:precontract-guide:v1', []);

  useEffect(() => {
    if (!enabled || pathname !== '/pre-contratos') return;
    if (!shouldForce && sessionStorage.getItem(sessionKey) === 'skipped') return;

    if (shouldForce) {
      sessionStorage.removeItem(sessionKey);
      setIndex(0);
      centeredRef.current = null;
      focusedRef.current = null;
    }

    const timer = setTimeout(() => setActive(true), 450);
    return () => clearTimeout(timer);
  }, [enabled, pathname, sessionKey, shouldForce]);

  useEffect(() => {
    if (!active || !step) return undefined;

    function sync({ center = false } = {}) {
      const target = findTarget(step);

      if (!target) {
        setMissing(true);
        setTargetRect(null);
        retryRef.current = window.setTimeout(() => sync({ center: true }), 600);
        return;
      }

      setMissing(false);

      if (center && centeredRef.current !== step.key) {
        centeredRef.current = step.key;
        centerTarget(target);
      }

      requestAnimationFrame(() => setTargetRect(target.getBoundingClientRect()));

      if (!step.waitsForShareModal && focusedRef.current !== step.key) {
        focusedRef.current = step.key;
        setTimeout(() => {
          const focusable = findFocusable(target);
          const tag = String(focusable?.tagName || '').toLowerCase();
          if (tag !== 'button' && tag !== 'a') focusable?.focus?.({ preventScroll: true });
        }, 160);
      }
    }

    sync({ center: true });

    const onResize = () => sync({ center: false });
    window.addEventListener('resize', onResize);

    const observer = new MutationObserver(() => {
      clearTimeout(retryRef.current);
      retryRef.current = window.setTimeout(() => sync({ center: false }), 220);
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    return () => {
      clearTimeout(retryRef.current);
      window.removeEventListener('resize', onResize);
      observer.disconnect();
    };
  }, [active, step]);

  if (!enabled || pathname !== '/pre-contratos' || !active || !step) return null;

  function finish() {
    sessionStorage.setItem(sessionKey, 'skipped');
    clearGuideQuery();
    setActive(false);
  }

  function next() {
    if (index >= STEPS.length - 1) return finish();
    centeredRef.current = null;
    focusedRef.current = null;
    setIndex((current) => current + 1);
  }

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const box = getBox(targetRect);
  const tooltipWidth = Math.min(460, vw - 32);
  const preferredLeft = targetRect ? targetRect.right + 24 : 16;
  const fallbackLeft = targetRect ? targetRect.left - tooltipWidth - 24 : 16;
  const left = preferredLeft + tooltipWidth < vw - 16
    ? preferredLeft
    : clamp(fallbackLeft, 16, vw - tooltipWidth - 16);
  const top = targetRect ? clamp(targetRect.top, 18, vh - 340) : 120;

  return (
    <div className="fixed inset-0 z-[270] pointer-events-none">
      <Mask box={box} width={vw} height={vh} />

      {box ? (
        <div
          className="absolute rounded-[24px] border-2 border-white bg-transparent shadow-[0_0_0_2px_rgba(124,58,237,0.30),0_18px_70px_rgba(124,58,237,0.44)] ring-4 ring-violet-500/25 transition-all duration-200"
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
        />
      ) : null}

      <div
        className="pointer-events-auto absolute rounded-[30px] border border-violet-200 bg-white p-5 shadow-[0_24px_90px_rgba(15,23,42,0.36)]"
        style={{ width: tooltipWidth, left, top }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">Guia: pré-contrato</div>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black text-violet-700">{index + 1}/{STEPS.length}</span>
        </div>

        <h3 className="mt-3 text-[22px] font-black tracking-[-0.04em] text-[#0f172a]">{step.title}</h3>
        <p className="mt-2 text-[14px] font-semibold leading-7 text-[#64748b]">{step.description}</p>

        {missing ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-bold leading-5 text-amber-800">
            Estou aguardando esse elemento aparecer. Se você ainda não salvou o pré-contrato, conclua a etapa anterior para continuar.
          </div>
        ) : null}

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-violet-600 transition-all duration-300" style={{ width: `${Math.round(((index + 1) / STEPS.length) * 100)}%` }} />
        </div>

        <div className="mt-5 flex flex-wrap justify-between gap-3">
          <button type="button" onClick={finish} className="rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-[13px] font-black text-[#475569]">Pular guia</button>
          <button type="button" onClick={next} className="rounded-2xl bg-violet-600 px-4 py-2.5 text-[13px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.28)]">
            {index >= STEPS.length - 1 ? 'Finalizar guia' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>
  );
}
