'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useOnboardingSession } from '@/contexts/OnboardingSessionContext';

const GUIDE_ID = 'precontract';

const CONTRACT_LINK_UNAVAILABLE_MESSAGE = 'O link do contrato ainda não está disponível.';

function getContractUrlFromSuccessModal() {
  if (typeof window === 'undefined') return '';

  const modal = document.querySelector('[data-precontract-share-modal="true"]');
  const openContractLink = Array.from(modal?.querySelectorAll?.('a[href]') || [])
    .find((link) => normalize(link.textContent || '').includes('abrir contrato'));
  const candidates = [
    modal?.getAttribute?.('data-contract-url'),
    modal?.querySelector?.('[data-contract-url]')?.getAttribute?.('data-contract-url'),
    modal?.querySelector?.('[data-guide="contract_link"]')?.textContent,
    openContractLink?.getAttribute('href'),
  ];

  const rawUrl = candidates.find((candidate) => String(candidate || '').trim());
  if (!rawUrl) return '';

  try {
    return new URL(String(rawUrl).trim(), window.location.origin).toString();
  } catch {
    return String(rawUrl).trim();
  }
}

const STEPS = [
  { key: 'event_type', title: 'Escolha o tipo de evento', description: 'Selecione o tipo configurado antes. Ele define o template padrão que será usado no contrato.', words: ['tipo de evento', 'tipo do evento'], names: ['event_type', 'event_type_id', 'eventTypeId'], required: true, error: 'Selecione um tipo de evento para continuar.' },
  { key: 'formation', title: 'Escolha a formação musical', description: 'Defina se será solo, duo, trio, quarteto ou outra formação.', words: ['formação'], names: ['formation'] },
  { key: 'event_date', title: 'Informe a data do evento', description: 'A data entra no contrato e ajuda nos prazos operacionais.', words: ['data'], names: ['event_date'] },
  { key: 'event_time', title: 'Informe o horário', description: 'Preencha o horário principal do evento.', words: ['hora', 'horário'], names: ['event_time'] },
  { key: 'duration', title: 'Revise a duração', description: 'Confira a duração prevista da apresentação.', words: ['duração'], names: ['duration_min'] },
  { key: 'instruments', title: 'Informe os instrumentos', description: 'Liste os instrumentos incluídos na formação.', words: ['instrumentos'], names: ['instruments'] },
  { key: 'location_optional', title: 'Local e endereço podem ficar para o cliente', description: 'Preencha agora apenas se já tiver certeza.', words: ['local', 'endereço'], names: ['location_name', 'location_address'] },
  { key: 'reception', title: 'Configure o receptivo se houver', description: 'Se houver receptivo, informe horas, formação e instrumentos.', words: ['receptivo', 'recepção'], names: ['reception_hours', 'reception_formation', 'reception_instruments', 'add_reception'] },
  { key: 'sound_transport', title: 'Marque som e transporte quando existir', description: 'Confira adicionais de som e transporte antes de salvar.', words: ['som', 'transporte'], names: ['has_sound', 'has_transport', 'add_sound', 'add_transport'] },
  { key: 'base_amount', title: 'Preencha o valor base', description: 'Informe o valor principal do serviço.', words: ['valor base'], names: ['base_amount'] },
  { key: 'agreed_amount', title: 'Confirme o valor acertado', description: 'Esse é o valor que aparecerá no contrato.', words: ['valor acertado'], names: ['agreed_amount'] },
  { key: 'payment', title: 'Revise pagamento', description: 'Confira sinal, saldo, cartão, datas e método de pagamento.', words: ['sinal', 'saldo', 'pagamento', 'cartão'], names: ['signal_amount', 'remaining_amount', 'payment_method', 'signal_due_date', 'balance_due_date', 'card_due_date'] },
  { key: 'client_optional', title: 'Dados do cliente são opcionais aqui', description: 'Nome, WhatsApp e e-mail podem ser preenchidos pelo cliente no link público.', words: ['nome de referência', 'whatsapp de referência', 'email de referência'], names: ['client_name', 'client_phone', 'client_email'] },
  { key: 'preview', title: 'Veja o preview antes de salvar', description: 'Abra a prévia e confira os dados. Ao clicar em Próximo, eu fecho a prévia e levo você ao botão de salvar.', words: ['ver preview', 'preview', 'visualizar', 'prévia'], preview: true },
  { key: 'save', title: 'Finalize o pré-contrato', description: 'Agora salve ou gere o link. O sistema criará o pré-contrato e abrirá o compartilhamento.', words: ['salvar e abrir envio', 'salvar', 'gerar link', 'criar pré-contrato'], button: true },
  { key: 'copy_link', title: 'Copie o link do contrato', description: 'Depois de salvar, copie o link para enviar ao cliente.', words: ['copiar link', 'link do contrato'], share: true },
  { key: 'open_contract', title: 'Abra o contrato em outra aba', description: 'Confira a experiência do cliente antes de enviar.', words: ['abrir contrato', 'abrir painel do cliente', 'abrir whatsapp'], share: true },
];

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isVisible(el) {
  if (!el || typeof window === 'undefined' || !document.body.contains(el)) return false;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}

function labelTextFor(el) {
  const parts = [];
  const id = el?.getAttribute?.('id');
  const aria = el?.getAttribute?.('aria-labelledby');
  if (id) parts.push(document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent || '');
  if (aria) aria.split(/\s+/).forEach((item) => parts.push(document.getElementById(item)?.textContent || ''));
  parts.push(el?.closest?.('label')?.textContent || '');

  const guideGroup = el?.closest?.('[data-guide-group]');
  if (guideGroup) {
    const focusableItems = guideGroup.querySelectorAll?.('input,select,textarea,button,a,[role="combobox"],[role="button"]');
    if (!focusableItems || focusableItems.length <= 1) {
      parts.push(guideGroup.textContent || '');
    }
  }

  return normalize(parts.join(' '));
}

function identity(el) {
  return normalize([
    el?.getAttribute?.('data-guide'),
    el?.getAttribute?.('data-tour'),
    el?.getAttribute?.('data-field'),
    el?.getAttribute?.('name'),
    el?.getAttribute?.('id'),
    el?.getAttribute?.('placeholder'),
    el?.getAttribute?.('aria-label'),
    labelTextFor(el),
    el?.textContent,
    el?.value,
  ].filter(Boolean).join(' '));
}

function fromLabel(label) {
  if (!label) return null;
  const htmlFor = label.getAttribute('for');
  if (htmlFor) {
    const explicit = document.getElementById(htmlFor);
    if (isVisible(explicit)) return explicit;
  }
  return label.querySelector('select,input,textarea,button,a,[role="combobox"],[role="button"]') || label;
}

function findByNames(names = []) {
  const exactAttributes = ['data-guide', 'data-field', 'data-tour'];
  const fallbackAttributes = ['name'];

  for (const name of names) {
    const escaped = CSS.escape(name);

    for (const attr of exactAttributes) {
      const found = document.querySelector(`[${attr}="${escaped}"]`);
      if (isVisible(found)) return focusable(found) || found;
    }

    for (const attr of fallbackAttributes) {
      const found = document.querySelector(`[${attr}="${escaped}"]`);
      if (isVisible(found)) return focusable(found) || found;
    }

    const foundById = document.querySelector(`#${escaped}`);
    if (isVisible(foundById)) return focusable(foundById) || foundById;
  }

  return null;
}

function findByWords(words = [], selector = 'input,select,textarea,button,a,label,[role="combobox"],[role="button"]') {
  const needles = words.map(normalize).filter(Boolean);
  const elements = Array.from(document.querySelectorAll(selector)).filter(isVisible);
  const found = elements.find((el) => needles.some((word) => identity(el).includes(word)));
  return found?.tagName === 'LABEL' ? fromLabel(found) : found || null;
}

function findPreviewModal() {
  const candidates = Array.from(document.querySelectorAll('div')).filter(isVisible).filter((el) => {
    const text = normalize(el.textContent || '');
    const rect = el.getBoundingClientRect();
    return rect.width > 480 && rect.height > 300 && (text.includes('preview do contrato') || text.includes('contrato de cliente')) && text.includes('fechar');
  });
  return candidates.sort((a, b) => (a.getBoundingClientRect().width * a.getBoundingClientRect().height) - (b.getBoundingClientRect().width * b.getBoundingClientRect().height))[0] || null;
}

function closePreviewModal() {
  const modal = findPreviewModal();
  if (!modal) return false;
  const button = Array.from(modal.querySelectorAll('button,[role="button"]')).filter(isVisible).find((el) => normalize(el.textContent || el.getAttribute('aria-label') || '').includes('fechar'));
  button?.click?.();
  return Boolean(button);
}

function findOpenContractTarget(step) {
  return findByWords(['abrir contrato'], 'button,a,[role="button"]')
    || document.querySelector('[data-precontract-share-modal="true"] [data-guide="contract_link"]')
    || findByWords(step.words, 'button,a,textarea,div,[role="button"]');
}

function findTarget(step) {
  if (step.preview) return findPreviewModal() || findByWords(step.words, 'button,a,[role="button"]');
  if (step.key === 'open_contract') return findOpenContractTarget(step);
  if (step.share) return findByWords(step.words, 'button,a,textarea,div,[role="button"]');
  return findByNames(step.names) || findByWords(step.words, step.button ? 'button,[role="button"],a' : undefined);
}

function focusable(el) {
  if (!el) return null;
  const tag = String(el.tagName || '').toLowerCase();
  if (['input', 'textarea', 'select', 'button', 'a'].includes(tag) || el.getAttribute?.('role') === 'combobox') return el;
  return el.querySelector?.('input,textarea,select,button,a,[role="combobox"]') || null;
}

function valueOf(el) {
  const item = focusable(el) || el;
  if (!item) return '';
  const tag = String(item.tagName || '').toLowerCase();
  if (['input', 'textarea', 'select'].includes(tag)) return String(item.value || '').trim();
  const text = normalize(item.textContent || '');
  if (!text || text.includes('selecione') || text.includes('escolha') || text.includes('tipo de evento')) return '';
  return text;
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

function boxFor(rect, step) {
  if (!rect) return null;
  const pad = step?.preview ? 6 : 14;
  return { left: Math.max(8, rect.left - pad), top: Math.max(8, rect.top - pad), width: rect.width + pad * 2, height: rect.height + pad * 2 };
}

function rectChanged(a, b) {
  if (!a || !b) return true;
  return Math.abs(a.left - b.left) > 1 || Math.abs(a.top - b.top) > 1 || Math.abs(a.width - b.width) > 1 || Math.abs(a.height - b.height) > 1;
}

function Mask({ box, width, height }) {
  const cls = 'absolute bg-slate-950/42 backdrop-blur-[1px] transition-all duration-200';
  if (!box) return <div className={`${cls} inset-0`} />;
  return <>
    <div className={cls} style={{ left: 0, top: 0, width: '100%', height: box.top }} />
    <div className={cls} style={{ left: 0, top: box.top, width: box.left, height: box.height }} />
    <div className={cls} style={{ left: box.left + box.width, top: box.top, width: Math.max(width - box.left - box.width, 0), height: box.height }} />
    <div className={cls} style={{ left: 0, top: box.top + box.height, width: '100%', height: Math.max(height - box.top - box.height, 0) }} />
  </>;
}

export default function PrecontractGuideStableV2({ enabled = false }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { onboardingSession, startOnboardingSession, endOnboardingSession } = useOnboardingSession();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [hint, setHint] = useState('');
  const [missing, setMissing] = useState(false);
  const targetRef = useRef(null);
  const rafRef = useRef(null);
  const retryRef = useRef(null);
  const centeredRef = useRef(null);
  const focusedRef = useRef(null);

  const resetTargetState = useCallback(() => {
    targetRef.current = null;
    centeredRef.current = null;
    focusedRef.current = null;
    setRect(null);
  }, []);
  const step = STEPS[index];
  const forced = searchParams?.get('guide') === 'precontract' || searchParams?.get('onboarding') === 'precontract';
  const sessionKey = useMemo(() => 'harmonics:precontract-guide:v9', []);

  useEffect(() => {
    if (!active) return undefined;
    startOnboardingSession({ guide: GUIDE_ID, overlay: GUIDE_ID, mode: 'dynamic-guide' });
    return () => endOnboardingSession(GUIDE_ID);
  }, [active, endOnboardingSession, startOnboardingSession]);

  const isBlockedByAnotherOnboarding = Boolean((onboardingSession.activeGuide && onboardingSession.activeGuide !== GUIDE_ID) || (onboardingSession.activeOverlay && onboardingSession.activeOverlay !== GUIDE_ID));

  useEffect(() => {
    if (!enabled || pathname !== '/pre-contratos') return;
    if (!forced && sessionStorage.getItem(sessionKey) === 'skipped') return;

    let resetFrame = null;
    if (forced) {
      sessionStorage.removeItem(sessionKey);
      targetRef.current = null;
      centeredRef.current = null;
      focusedRef.current = null;
      resetFrame = requestAnimationFrame(() => {
        setIndex(0);
        resetTargetState();
      });
    }

    const timer = setTimeout(() => setActive(true), 450);

    return () => {
      if (resetFrame) cancelAnimationFrame(resetFrame);
      clearTimeout(timer);
    };
  }, [enabled, forced, pathname, resetTargetState, sessionKey]);

  useEffect(() => {
    targetRef.current = null;
    centeredRef.current = null;
    focusedRef.current = null;

    const frame = requestAnimationFrame(() => {
      resetTargetState();
      setMissing(false);

      if (!active || !step) return;

      const nextTarget = findTarget(step);
      targetRef.current = nextTarget;
      setMissing(!nextTarget);
      if (nextTarget) setRect(nextTarget.getBoundingClientRect());
    });

    return () => cancelAnimationFrame(frame);
  }, [active, index, resetTargetState, step]);

  useEffect(() => {
    if (!active || !step) return undefined;

    function sync({ center = false, focus = false } = {}) {
      const current = targetRef.current;
      const nextTarget = isVisible(current) ? current : findTarget(step);

      if (!nextTarget) {
        targetRef.current = null;
        setMissing(true);
        setRect(null);
        return null;
      }

      targetRef.current = nextTarget;
      setMissing(false);

      if (center && centeredRef.current !== step.key && !(step.preview && findPreviewModal())) {
        centeredRef.current = step.key;
        nextTarget.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'auto' });
      }

      if (focus && !step.preview && !step.share && focusedRef.current !== step.key) {
        focusedRef.current = step.key;
        setTimeout(() => focusable(nextTarget)?.focus?.({ preventScroll: true }), 160);
      }

      const nextRect = nextTarget.getBoundingClientRect();
      setRect((previous) => (rectChanged(previous, nextRect) ? nextRect : previous));
      return nextTarget;
    }

    sync({ center: true, focus: true });

    function tick() {
      const latest = findTarget(step);
      if (latest && latest !== targetRef.current) {
        targetRef.current = latest;
        if (centeredRef.current !== step.key && !(step.preview && findPreviewModal())) {
          latest.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'auto' });
          centeredRef.current = step.key;
        }
      }
      sync({ center: false, focus: false });
      rafRef.current = window.setTimeout(() => {
        rafRef.current = requestAnimationFrame(tick);
      }, 180);
    }

    rafRef.current = requestAnimationFrame(tick);

    const onScrollOrResize = () => sync({ center: false, focus: false });
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);

    const observer = new MutationObserver((mutations) => {
      if (mutations.every((m) => m.target?.closest?.('[data-precontract-guide="true"]'))) return;
      clearTimeout(retryRef.current);
      retryRef.current = setTimeout(() => {
        targetRef.current = null;
        sync({ center: false, focus: false });
      }, 80);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    return () => {
      clearTimeout(retryRef.current);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        clearTimeout(rafRef.current);
      }
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
      observer.disconnect();
    };
  }, [active, step]);

  if (!enabled || pathname !== '/pre-contratos' || !active || !step || isBlockedByAnotherOnboarding) return null;

  function finish() {
    sessionStorage.setItem(sessionKey, 'skipped');
    clearGuideQuery();
    setActive(false);
  }

  function openContractAndFinish() {
    const contractUrl = getContractUrlFromSuccessModal();
    if (!contractUrl) {
      setHint(CONTRACT_LINK_UNAVAILABLE_MESSAGE);
      return;
    }

    window.open(contractUrl, '_blank', 'noopener,noreferrer');
    finish();
  }

  function next() {
    const target = findTarget(step);
    if (step.required && !valueOf(target)) {
      setHint(step.error || 'Preencha esta etapa para continuar.');
      targetRef.current = target;
      target?.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'auto' });
      focusable(target)?.focus?.({ preventScroll: true });
      if (target) requestAnimationFrame(() => setRect(target.getBoundingClientRect()));
      return;
    }

    setHint('');

    if (step.preview && findPreviewModal()) {
      closePreviewModal();
      setTimeout(() => {
        resetTargetState();
        setIndex((current) => Math.min(current + 1, STEPS.length - 1));
      }, 300);
      return;
    }

    if (index >= STEPS.length - 1) return openContractAndFinish();
    resetTargetState();
    setIndex((current) => current + 1);
  }

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const spotlight = boxFor(rect, step);
  const tooltipWidth = Math.min(460, vw - 32);
  const previewMode = step.preview && !!findPreviewModal();
  const left = previewMode
    ? clamp(vw - tooltipWidth - 28, 16, vw - tooltipWidth - 16)
    : rect && rect.right + tooltipWidth + 24 < vw - 16
      ? rect.right + 24
      : rect
        ? clamp(rect.left - tooltipWidth - 24, 16, vw - tooltipWidth - 16)
        : 16;
  const top = previewMode ? clamp(vh - 330, 18, vh - 320) : rect ? clamp(rect.top, 18, vh - 340) : 120;

  return <div data-precontract-guide="true" className="fixed inset-0 z-[270] pointer-events-none">
    <Mask box={spotlight} width={vw} height={vh} />
    {spotlight ? <div className="absolute rounded-[24px] border-2 border-white bg-transparent shadow-[0_0_0_2px_rgba(124,58,237,0.30),0_18px_70px_rgba(124,58,237,0.44)] ring-4 ring-violet-500/25 transition-all duration-200" style={spotlight} /> : null}
    <div className="pointer-events-auto absolute rounded-[30px] border border-violet-200 bg-white p-5 shadow-[0_24px_90px_rgba(15,23,42,0.36)]" style={{ width: tooltipWidth, left, top }}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">Guia: pré-contrato</div>
        <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black text-violet-700">{index + 1}/{STEPS.length}</span>
      </div>
      <h3 className="mt-3 text-[22px] font-black tracking-[-0.04em] text-[#0f172a]">{step.title}</h3>
      <p className="mt-2 text-[14px] font-semibold leading-7 text-[#64748b]">{step.description}</p>
      {hint ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-bold leading-5 text-red-700">{hint}</div> : null}
      {missing ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-bold leading-5 text-amber-800">Estou aguardando esse elemento aparecer.</div> : null}
      {previewMode ? <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-[12px] font-bold leading-5 text-violet-800">Confira a prévia. No próximo clique eu fecho o preview e mostro o botão de salvar corretamente.</div> : null}
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-600 transition-all duration-300" style={{ width: `${Math.round(((index + 1) / STEPS.length) * 100)}%` }} /></div>
      <div className="mt-5 flex flex-wrap justify-between gap-3">
        <button type="button" onClick={finish} className="rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-[13px] font-black text-[#475569]">Pular guia</button>
        <button type="button" onClick={next} className="rounded-2xl bg-violet-600 px-4 py-2.5 text-[13px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.28)]">{index >= STEPS.length - 1 ? 'Abrir contrato e finalizar' : 'Próximo'}</button>
      </div>
    </div>
  </div>;
}
