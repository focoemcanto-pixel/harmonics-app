'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const STEPS = [
  { key: 'event_type', title: 'Escolha o tipo de evento', description: 'Comece selecionando o tipo configurado antes. Ele define o template padrão que será usado no contrato.', texts: ['tipo de evento', 'event_type', 'casamento'], exactNames: ['event_type', 'event_type_id'], selector: 'select, input, button, label' },
  { key: 'formation', title: 'Escolha a formação musical', description: 'Defina se será duo, trio, quarteto ou outra formação. Essa informação entra no contrato e ajuda na operação da escala.', texts: ['formação', 'formation'], exactNames: ['formation'], selector: 'select, input, label, button' },
  { key: 'event_date', title: 'Informe a data do evento', description: 'A data é obrigatória para validar agenda, calcular prazos de pagamento e aparecer corretamente no contrato.', texts: ['data'], exactNames: ['event_date'], selector: 'input, label, button' },
  { key: 'event_time', title: 'Informe o horário', description: 'Preencha o horário principal do evento. Se ainda não souber, deixe pendente, mas o ideal é confirmar antes de enviar ao cliente.', texts: ['hora', 'horário'], exactNames: ['event_time'], selector: 'input, label, button' },
  { key: 'duration', title: 'Revise a duração', description: 'Confira a duração prevista da apresentação. Esse dado orienta contrato, agenda e cálculo da operação.', texts: ['duração', 'duration', 'min'], exactNames: ['duration_min'], selector: 'input, label, button' },
  { key: 'instruments', title: 'Informe os instrumentos', description: 'Liste os instrumentos incluídos na formação. Isso evita dúvidas do cliente e ajuda a equipe a entender o escopo.', texts: ['instrumentos', 'instrumento'], exactNames: ['instruments'], selector: 'input, textarea, label' },
  { key: 'location_optional', title: 'Local e endereço podem ficar para o cliente', description: 'Local e endereço são opcionais aqui porque o cliente poderá preencher no link público. Preencha agora apenas se já tiver certeza.', texts: ['local', 'endereço'], exactNames: ['location_name', 'location_address'], selector: 'input, textarea, label' },
  { key: 'reception', title: 'Configure o receptivo se houver', description: 'Se o contrato incluir receptivo, informe horas, formação e instrumentos do receptivo. Se não houver, mantenha desativado ou zerado.', texts: ['receptivo', 'recepção'], exactNames: ['reception_hours', 'reception_formation', 'reception_instruments', 'add_reception'], selector: 'input, select, label, button' },
  { key: 'sound_transport', title: 'Marque som e transporte quando existir', description: 'Se houver adicional de som ou transporte, marque as opções e confira os valores extras antes de salvar.', texts: ['som', 'transporte'], exactNames: ['has_sound', 'has_transport', 'add_sound', 'add_transport'], selector: 'input, label, button' },
  { key: 'base_amount', title: 'Preencha o valor base', description: 'Informe o valor principal do serviço. Esse é o ponto de partida para o valor acertado no contrato.', texts: ['valor base'], exactNames: ['base_amount'], selector: 'input, label' },
  { key: 'extras_amount', title: 'Confira os adicionais', description: 'Revise adicional de receptivo, som e transporte. Eles devem compor o valor final se forem cobrados separadamente.', texts: ['adicional receptivo', 'adicional som', 'adicional transporte'], exactNames: ['add_reception', 'add_sound', 'add_transport'], selector: 'input, label' },
  { key: 'agreed_amount', title: 'Confirme o valor acertado', description: 'O valor acertado é o que será apresentado no contrato. Confira antes de avançar para o preview.', texts: ['valor acertado', 'valor final'], exactNames: ['agreed_amount'], selector: 'input, label, div' },
  { key: 'payment', title: 'Revise sinal, saldo e pagamento', description: 'Se usar sinal, saldo ou cartão, confira valores, datas e método de pagamento. Esses dados podem aparecer no contrato.', texts: ['sinal', 'saldo', 'pagamento', 'cartão'], exactNames: ['signal_amount', 'remaining_amount', 'payment_method', 'signal_due_date', 'balance_due_date', 'card_due_date', 'payment_card'], selector: 'input, select, label, button' },
  { key: 'client_optional', title: 'Dados do cliente são opcionais aqui', description: 'Nome, WhatsApp e e-mail podem ser deixados para o cliente preencher no link público. Use esses campos só quando já tiver os dados corretos.', texts: ['nome do cliente', 'whatsapp', 'e-mail', 'email'], exactNames: ['client_name', 'client_phone', 'client_email'], selector: 'input, textarea, label' },
  { key: 'preview', title: 'Veja o preview antes de salvar', description: 'Abra a prévia e confira o modal inteiro: dados do evento, valores, formação e contrato puxando o template correto.', texts: ['preview', 'visualizar', 'prévia', 'ver contrato', 'visualização'], selector: 'button, a, [role="button"]', preferPreviewModal: true },
  { key: 'edit_contract_optional', title: 'Edição do contrato é opcional', description: 'Se precisar ajustar uma cláusula só neste contrato, use a edição personalizada. Se o template estiver certo, siga sem mexer.', texts: ['editar contrato', 'contrato personalizado', 'personalizar contrato', 'customizar contrato', 'editar modelo'], exactNames: ['custom_contract_enabled', 'custom_contract_content', 'custom_contract_rich_html'], selector: 'button, a, label, input, [role="button"]' },
  { key: 'save', title: 'Finalize o pré-contrato', description: 'Agora salve ou gere o link. O sistema criará o pré-contrato e abrirá o compartilhamento para envio ao cliente.', texts: ['salvar e abrir envio', 'salvar', 'gerar link', 'criar pré-contrato', 'finalizar', 'salvar pré-contrato'], selector: 'button, [role="button"]' },
  { key: 'copy_link', title: 'Copie o link do contrato', description: 'Depois de salvar, copie o link para enviar ao cliente pelo WhatsApp ou outro canal.', texts: ['copiar link', 'link do contrato', 'contrato salvo', 'link pronto'], selector: 'button, a, textarea, div', waitsForShareModal: true },
  { key: 'open_contract', title: 'Abra o contrato em outra aba', description: 'Abra o link para visualizar a experiência do cliente e conferir se tudo está correto antes de enviar.', texts: ['abrir whatsapp', 'abrir painel do cliente', 'abrir contrato', 'link do contrato'], selector: 'button, a, div', waitsForShareModal: true },
];

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isVisible(el) {
  if (!el || typeof window === 'undefined') return false;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}

function getLabelText(el) {
  if (!el) return '';
  const id = el.getAttribute?.('id');
  const aria = el.getAttribute?.('aria-labelledby');
  const parts = [];

  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label) parts.push(label.textContent || '');
  }

  if (aria) {
    aria.split(/\s+/).forEach((labelId) => {
      const node = document.getElementById(labelId);
      if (node) parts.push(node.textContent || '');
    });
  }

  const closestLabel = el.closest?.('label');
  if (closestLabel) parts.push(closestLabel.textContent || '');

  const previous = el.previousElementSibling;
  if (previous && ['LABEL', 'SPAN', 'P', 'DIV'].includes(previous.tagName)) parts.push(previous.textContent || '');

  return normalize(parts.join(' '));
}

function fieldIdentityText(el) {
  if (!el) return '';
  return normalize([
    el.getAttribute?.('data-tour'),
    el.getAttribute?.('name'),
    el.getAttribute?.('id'),
    el.getAttribute?.('placeholder'),
    el.getAttribute?.('aria-label'),
    getLabelText(el),
  ].filter(Boolean).join(' '));
}

function textOf(el) {
  if (!el) return '';
  return normalize([
    fieldIdentityText(el),
    el.value,
    el.textContent,
  ].filter(Boolean).join(' '));
}

function findByExactNames(names = []) {
  if (!names.length) return null;
  const selectors = names.flatMap((name) => {
    const escaped = CSS.escape(name);
    return [`[name="${escaped}"]`, `#${escaped}`, `[data-tour="${escaped}"]`, `[data-field="${escaped}"]`];
  }).join(',');

  if (!selectors) return null;
  return Array.from(document.querySelectorAll(selectors)).find(isVisible) || null;
}

function findByFieldIdentity(texts, selector) {
  const needles = (texts || []).map(normalize).filter(Boolean);
  const elements = Array.from(document.querySelectorAll(selector || 'input, select, textarea, button, a, label, [role="button"]'));

  return elements.find((el) => {
    if (!isVisible(el)) return false;
    const identity = fieldIdentityText(el);
    return needles.some((needle) => identity.includes(needle));
  }) || null;
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

function findPreviewModal() {
  if (typeof document === 'undefined') return null;
  const candidates = Array.from(document.querySelectorAll('div')).filter(isVisible).filter((el) => {
    const text = normalize(el.textContent || '');
    const rect = el.getBoundingClientRect();
    return rect.width >= 520 && rect.height >= 360 && text.includes('visualizacao premium') && text.includes('preview do contrato');
  }).sort((a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return (a.children.length - b.children.length) || ((ar.width * ar.height) - (br.width * br.height));
  });
  return candidates[0] || null;
}

function findTarget(step) {
  if (step.preferPreviewModal) {
    const modal = findPreviewModal();
    if (modal) return modal;
  }

  if (step.waitsForShareModal) {
    const modalTarget = findByTexts(step.texts, step.selector);
    if (modalTarget) return modalTarget;
  }

  return findByExactNames(step.exactNames)
    || findByFieldIdentity(step.texts, step.selector)
    || findByTexts(step.texts, step.selector);
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

function getBox(rect, step) {
  if (!rect) return null;
  const padding = step?.preferPreviewModal ? 6 : 14;
  return { left: Math.max(8, rect.left - padding), top: Math.max(8, rect.top - padding), width: rect.width + padding * 2, height: rect.height + padding * 2 };
}

function centerTarget(target, step) {
  if (step?.preferPreviewModal && findPreviewModal()) return;
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
  return <>
    <div className={cls} style={{ left: 0, top: 0, width: '100%', height: box.top }} />
    <div className={cls} style={{ left: 0, top: box.top, width: box.left, height: box.height }} />
    <div className={cls} style={{ left: box.left + box.width, top: box.top, width: Math.max(width - box.left - box.width, 0), height: box.height }} />
    <div className={cls} style={{ left: 0, top: box.top + box.height, width: '100%', height: Math.max(height - box.top - box.height, 0) }} />
  </>;
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
  const sessionKey = useMemo(() => 'harmonics:precontract-guide:v4', []);

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
        centerTarget(target, step);
      }
      requestAnimationFrame(() => setTargetRect(target.getBoundingClientRect()));
      if (!step.waitsForShareModal && !step.preferPreviewModal && focusedRef.current !== step.key) {
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
  const box = getBox(targetRect, step);
  const tooltipWidth = Math.min(460, vw - 32);
  const previewMode = step?.preferPreviewModal && !!findPreviewModal();
  const preferredLeft = targetRect ? targetRect.right + 24 : 16;
  const fallbackLeft = targetRect ? targetRect.left - tooltipWidth - 24 : 16;
  const left = previewMode ? clamp(vw - tooltipWidth - 28, 16, vw - tooltipWidth - 16) : (preferredLeft + tooltipWidth < vw - 16 ? preferredLeft : clamp(fallbackLeft, 16, vw - tooltipWidth - 16));
  const top = previewMode ? clamp(vh - 330, 18, vh - 320) : (targetRect ? clamp(targetRect.top, 18, vh - 340) : 120);

  return <div className="fixed inset-0 z-[270] pointer-events-none">
    <Mask box={box} width={vw} height={vh} />
    {box ? <div className="absolute rounded-[24px] border-2 border-white bg-transparent shadow-[0_0_0_2px_rgba(124,58,237,0.30),0_18px_70px_rgba(124,58,237,0.44)] ring-4 ring-violet-500/25 transition-all duration-200" style={{ left: box.left, top: box.top, width: box.width, height: box.height }} /> : null}
    <div className="pointer-events-auto absolute rounded-[30px] border border-violet-200 bg-white p-5 shadow-[0_24px_90px_rgba(15,23,42,0.36)]" style={{ width: tooltipWidth, left, top }}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">Guia: pré-contrato</div>
        <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black text-violet-700">{index + 1}/{STEPS.length}</span>
      </div>
      <h3 className="mt-3 text-[22px] font-black tracking-[-0.04em] text-[#0f172a]">{step.title}</h3>
      <p className="mt-2 text-[14px] font-semibold leading-7 text-[#64748b]">{step.description}</p>
      {missing ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-bold leading-5 text-amber-800">Estou aguardando esse elemento aparecer. Se esta etapa estiver mais abaixo, role a página ou avance após preencher o bloco atual.</div> : null}
      {previewMode ? <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-[12px] font-bold leading-5 text-violet-800">O preview está liberado no tamanho completo. Role dentro dele se precisar conferir todas as cláusulas antes de salvar.</div> : null}
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-600 transition-all duration-300" style={{ width: `${Math.round(((index + 1) / STEPS.length) * 100)}%` }} /></div>
      <div className="mt-5 flex flex-wrap justify-between gap-3">
        <button type="button" onClick={finish} className="rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-[13px] font-black text-[#475569]">Pular guia</button>
        <button type="button" onClick={next} className="rounded-2xl bg-violet-600 px-4 py-2.5 text-[13px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.28)]">{index >= STEPS.length - 1 ? 'Finalizar guia' : 'Próximo'}</button>
      </div>
    </div>
  </div>;
}
