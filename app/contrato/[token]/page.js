'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Badge from '../../../components/ui/Badge';
import { useGoogleMapsReady } from '../../../hooks/useGoogleMapsReady';
import { normalizeTimeStrict, isValidTime, sanitizeTimeFields } from '../../../lib/time/normalize-time';
import { getAutomaticCosts } from '../../../lib/eventos/eventos-finance';
import { buildContractTemplateData } from '../../../lib/contracts/buildContractTemplateData';
import { generateInternalContract } from '../../../lib/contracts/internalContractGenerator';
import { renderContractHtmlWithData, resolveContractHtmlSource } from '../../../lib/contracts/resolveContractHtmlSource';
import { useAppToast } from '../../../components/ui/ToastProvider';
const IS_DEV = process.env.NODE_ENV !== 'production';
const ENABLE_LEGACY_CONTRACT_SIGN_FALLBACK =
  process.env.NEXT_PUBLIC_ENABLE_LEGACY_CONTRACT_SIGN_FALLBACK === 'true';

function devLog(message, payload) {
  if (!IS_DEV) return;
  if (payload === undefined) {
    console.info(message);
    return;
  }
  console.info(message, payload);
}

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

function formatDateBR(value) {
  if (!value) return '-';
  const [y, m, d] = String(value).split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}
function formatDateTimeBR(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', { hour12: false }).slice(0, 16);
}

function cleanDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function maskPhone(value) {
  const digits = cleanDigits(value).slice(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function maskCpf(value) {
  const digits = cleanDigits(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

function maskCep(value) {
  const digits = cleanDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function maskDate(value) {
  const digits = cleanDigits(value).slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function maskTime(value) {
  const normalized = normalizeTimeStrict(value);
  if (/^\d{2}:\d{2}$/.test(normalized)) return normalized;

  const digits = cleanDigits(value).slice(0, 4);

  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function convertDateToInput(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);

  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return String(value);

  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

function convertDateToBr(value) {
  if (!value) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(value))) return String(value);

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value);

  const [, yyyy, mm, dd] = match;
  return `${dd}/${mm}/${yyyy}`;
}

function buildClientAddress(formData) {
  const parts = [
    String(formData?.address_street || '').trim(),
    String(formData?.address_number || '').trim()
      ? `nº ${String(formData?.address_number || '').trim()}`
      : '',
    String(formData?.address_complement || '').trim(),
    String(formData?.address_neighborhood || '').trim(),
    String(formData?.address_cep || '').trim()
      ? `CEP ${String(formData?.address_cep || '').trim()}`
      : '',
    String(formData?.address_city || '').trim(),
    String(formData?.address_state || '').trim(),
  ].filter(Boolean);

  return parts.join(', ');
}

function mergeTemplateDataPriority(...sources) {
  const merged = {};

  sources.forEach((source) => {
    if (!source || typeof source !== 'object') return;
    Object.entries(source).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (typeof value === 'string' && value.trim() === '') return;
      merged[key] = value;
    });
  });

  return merged;
}

function isValidCpf(value) {
  const cpf = cleanDigits(value);

  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(cpf[i]) * (10 - i);
  }

  let firstDigit = (sum * 10) % 11;
  if (firstDigit === 10) firstDigit = 0;
  if (firstDigit !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += Number(cpf[i]) * (11 - i);
  }

  let secondDigit = (sum * 10) % 11;
  if (secondDigit === 10) secondDigit = 0;

  return secondDigit === Number(cpf[10]);
}

function isValidPhone(value) {
  const digits = cleanDigits(value);
  return digits.length >= 10 && digits.length <= 11;
}

function isValidCep(value) {
  return cleanDigits(value).length === 8;
}

function isValidDateBr(value) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(String(value || ''))) return false;

  const [dd, mm, yyyy] = String(value).split('/').map(Number);
  const date = new Date(yyyy, mm - 1, dd);

  return (
    date.getFullYear() === yyyy &&
    date.getMonth() === mm - 1 &&
    date.getDate() === dd
  );
}


function getAddressComponent(components, type) {
  if (!Array.isArray(components)) return '';
  const found = components.find(
    (item) => Array.isArray(item.types) && item.types.includes(type)
  );
  return found?.long_name || '';
}

function getAddressComponentShort(components, type) {
  if (!Array.isArray(components)) return '';
  const found = components.find(
    (item) => Array.isArray(item.types) && item.types.includes(type)
  );
  return found?.short_name || found?.long_name || '';
}

function extractAddressDataFromPlace(place) {
  const components = place?.address_components || [];

  const street = getAddressComponent(components, 'route');
  const number = getAddressComponent(components, 'street_number');

  const neighborhood =
    getAddressComponent(components, 'sublocality_level_1') ||
    getAddressComponent(components, 'sublocality') ||
    getAddressComponent(components, 'neighborhood');

  const city =
    getAddressComponent(components, 'administrative_area_level_2') ||
    getAddressComponent(components, 'locality');

  const state = getAddressComponentShort(
    components,
    'administrative_area_level_1'
  );

  const cep = maskCep(getAddressComponent(components, 'postal_code'));

  return {
    formattedAddress: place?.formatted_address || '',
    street: street || '',
    number: number || '',
    neighborhood: neighborhood || '',
    city: city || '',
    state: state || '',
    cep: cep || '',
  };
}
function getInitialForm() {
  return {
    full_name: '',
    marital_status: '',
    profession: '',
    cpf: '',
    rg: '',
    whatsapp: '',

    address_street: '',
    address_number: '',
    address_complement: '',
    address_neighborhood: '',
    address_cep: '',
    address_city: '',
    address_state: '',

    event_date: '',
    event_time: '',
    event_location_name: '',
    event_location_address: '',

    adjustment_request: '',

    signer_name: '',
    signer_cpf: '',
    accepted_terms: false,
  };
}

function normalizeContractData(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const contract = payload?.contract || payload?.contracts || null;
  const precontract = payload?.precontract || null;
  const signed =
    payload?.signed === true ||
    contract?.status === 'signed' ||
    precontract?.status === 'signed';
  const pdfUrl =
    contract?.pdf_url ||
    payload?.pdf_url ||
    payload?.signature?.pdf_url ||
    null;

  return {
    signed,
    pdf_url: pdfUrl,
    contract: contract
      ? {
          ...contract,
          pdf_url: contract?.pdf_url || pdfUrl || null,
        }
      : null,
    precontract,
    event: payload?.event || null,
    contact: payload?.contact || null,
  };
}

async function fetchPublicContract(token) {
  const safeToken = String(token || '').trim();
  if (!safeToken) {
    throw new Error('Token do contrato não encontrado.');
  }

  const response = await fetch(`/api/public/contracts/${safeToken}`, {
    method: 'GET',
    cache: 'no-store',
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      payload?.message ||
        payload?.error ||
        `Falha ao consultar contrato público (status ${response.status}).`
    );
  }

  return normalizeContractData(payload);
}


async function fetchPublicContractDraft(token) {
  const safeToken = String(token || '').trim();
  if (!safeToken) throw new Error('Token do contrato não encontrado.');
  const response = await fetch(`/api/public/contracts/${safeToken}/draft`, { method: 'GET', cache: 'no-store' });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || 'Falha ao carregar rascunho.');
  return payload;
}

async function savePublicContractDraft(token, form) {
  const safeToken = String(token || '').trim();
  if (!safeToken) throw new Error('Token do contrato não encontrado.');
  const response = await fetch(`/api/public/contracts/${safeToken}/draft`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ form }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || 'Falha ao salvar rascunho.');
  return payload;
}
function SummaryItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">
        {value || '-'}
      </p>
    </div>
  );
}

function SectionTitle({ children, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold text-slate-900">{children}</h2>
      {subtitle ? (
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      ) : null}
    </div>
  );
}

function FieldFeedback({ error, success }) {
  if (error) {
    return <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>;
  }

  if (success) {
    return <p className="mt-2 text-xs font-semibold text-emerald-600">{success}</p>;
  }

  return null;
}


const CLIENT_CONTRACT_GUIDE_QUERY_VALUE = 'client-contract';
const CLIENT_CONTRACT_SUCCESS_GUIDE_QUERY_VALUE = 'client-contract-success';
const GUIDE_TEST_CPF = '529.982.247-25';

const CLIENT_CONTRACT_GUIDE_SAMPLE_DATA = [
  ['Nome completo', 'Cliente Teste'],
  ['Estado civil', 'Solteiro'],
  ['Profissão', 'Empresário'],
  ['CPF', GUIDE_TEST_CPF],
  ['Endereço', 'Rua Teste, 123'],
  ['Cidade/UF', 'Salvador/BA'],
  ['Nome na assinatura', 'Cliente Teste'],
];


function markOnboardingFlowState(patch = {}) {
  if (!patch || typeof patch !== 'object') return Promise.resolve(null);
  return supabase.auth.getSession()
    .then(({ data }) => {
      const accessToken = data?.session?.access_token;
      return fetch('/api/onboarding/flow-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ flowState: patch }),
      });
    })
    .catch((error) => {
      console.warn('[ONBOARDING_GUIDE][FLOW_STATE_ERROR]', error?.message || error);
      return null;
    });
}

function ClientContractSuccessGuide({ pdfUrl, clientPanelUrl, onOpenPdf, onOpenClientPanel, onClose }) {
  const [step, setStep] = useState('pdf');
  const [message, setMessage] = useState('');

  const isPdfStep = step === 'pdf';
  const title = isPdfStep ? 'Confira o PDF assinado' : 'Abra o painel do cliente';
  const text = isPdfStep
    ? 'Abra o PDF em uma nova aba para conferir como o contrato assinado será entregue ao cliente.'
    : 'Agora abra o painel do cliente para conhecer a área onde ele poderá acompanhar informações, repertório, financeiro e próximos passos.';

  async function handlePrimaryAction() {
    setMessage('');
    if (isPdfStep) {
      if (!pdfUrl) {
        setMessage('O PDF ainda não está disponível. Aguarde a geração finalizar e tente novamente.');
        return;
      }
      onOpenPdf?.();
      await markOnboardingFlowState({ signed_pdf_opened: true });
      setStep('panel');
      return;
    }

    if (!clientPanelUrl) {
      setMessage('O link do painel do cliente ainda não está disponível para este contrato.');
      return;
    }
    await markOnboardingFlowState({ client_panel_opened: true });
    onOpenClientPanel?.();
  }

  return (
    <aside className="fixed bottom-4 right-4 z-[70] w-[calc(100vw-2rem)] max-w-md rounded-3xl border border-emerald-200 bg-white/95 p-4 shadow-2xl shadow-emerald-950/20 backdrop-blur md:bottom-6 md:right-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Guia pós-assinatura</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">{title}</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-500 transition hover:bg-slate-50" aria-label="Ocultar guia">×</button>
      </div>

      <div className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm leading-relaxed text-emerald-950 ring-1 ring-emerald-100">
        {text}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-slate-500">
        <div className={`rounded-2xl border px-3 py-2 ${isPdfStep ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-emerald-200 bg-white text-emerald-700'}`}>1. PDF assinado</div>
        <div className={`rounded-2xl border px-3 py-2 ${!isPdfStep ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white'}`}>2. Painel do cliente</div>
      </div>

      {message ? <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">{message}</div> : null}

      <button type="button" onClick={handlePrimaryAction} className="mt-4 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700">
        {isPdfStep ? 'Abrir PDF' : 'Abrir painel do cliente'}
      </button>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Nada será aberto automaticamente: a nova aba só aparece depois do seu clique e esta tela de sucesso permanece aberta.
      </p>
    </aside>
  );
}

function getGuidePositionClass(currentSpotlight) {
  if (currentSpotlight === 'correction') {
    return 'right-4 md:right-6 top-4 bottom-auto md:top-6';
  }

  if (currentSpotlight === 'clientData') {
    return 'right-4 md:right-6';
  }

  if (
    currentSpotlight === 'contractViewer' ||
    currentSpotlight === 'signature' ||
    currentSpotlight === 'signButton'
  ) {
    return 'left-4 right-auto md:left-6 md:right-auto';
  }

  return 'right-4 md:right-6';
}

function ClientContractGuide({
  steps,
  currentSpotlight,
  onMarkCorrectionExplained,
  onFillSampleData,
  onClose,
}) {
  const guidePositionClass = getGuidePositionClass(currentSpotlight);
  const isSignatureSpotlight = currentSpotlight === 'signature' || currentSpotlight === 'signButton';
  const isCorrectionSpotlight = currentSpotlight === 'correction';
  const completedCount = steps.filter((step) => step.done).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);
  const currentStep = steps.find((step) => !step.done) || steps[steps.length - 1];
  const spotlightLabels = {
    contractViewer: 'Visualizar contrato',
    clientData: 'Dados do contratante',
    correction: 'Solicitar correção',
    signature: 'Assinatura eletrônica',
    signButton: 'Botão assinar',
    done: 'Fluxo finalizado',
  };

  return (
    <aside className={`fixed bottom-4 z-[60] w-[calc(100vw-2rem)] max-w-md rounded-3xl border border-violet-200 bg-white/95 p-4 shadow-2xl shadow-violet-950/20 backdrop-blur md:bottom-6 ${guidePositionClass} ${
      isSignatureSpotlight || isCorrectionSpotlight ? 'max-h-[calc(100vh-2rem)] overflow-y-auto' : ''
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-600">
            Guia do onboarding
          </p>
          <h2 className="mt-1 text-lg font-black text-slate-950">
            Simulação da visão do cliente
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-500 transition hover:bg-slate-50"
          aria-label="Ocultar guia"
        >
          ×
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
        <p className="font-bold">Use apenas em token de teste/onboarding.</p>
        <p className="mt-1">
          Este modo não salva o rascunho, não envia WhatsApp real e não dispara automações reais ao simular a assinatura.
        </p>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
          <span>{completedCount}/{steps.length} etapas concluídas</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-violet-600 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-violet-50 p-3 text-sm text-violet-950 ring-1 ring-violet-100">
        <p className="font-bold">Agora:</p>
        <p className="mt-1">{currentStep?.hint}</p>
        <p className="mt-2 text-xs font-semibold text-violet-700">
          Área em foco: {spotlightLabels[currentSpotlight] || 'Visão geral'}
        </p>
      </div>
      {currentSpotlight === 'correction' ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-relaxed text-amber-800">
          Nesta simulação, não envie uma solicitação de correção agora. Essa função bloqueia a assinatura até o admin revisar e liberar o pré-contrato.
        </div>
      ) : null}

      <ul className="mt-4 space-y-2">
        {steps.map((step) => (
          <li key={step.key} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-black ${step.done ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 ring-1 ring-slate-200'}`}>
              {step.done ? '✓' : '•'}
            </span>
            <div>
              <p className="text-sm font-bold text-slate-800">{step.label}</p>
              <p className="text-xs leading-relaxed text-slate-500">{step.description}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-2xl border border-slate-200 p-3">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
          Dados fictícios sugeridos
        </p>
        <dl className="mt-2 grid grid-cols-1 gap-1.5 text-xs text-slate-600 sm:grid-cols-2">
          {CLIENT_CONTRACT_GUIDE_SAMPLE_DATA.map(([label, value]) => (
            <div key={label}>
              <dt className="font-bold text-slate-700">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onFillSampleData}
          className="rounded-2xl bg-violet-600 px-3 py-2 text-xs font-black text-white transition hover:bg-violet-700"
        >
          Aplicar dados de exemplo
        </button>
        <button
          type="button"
          onClick={onMarkCorrectionExplained}
          className="rounded-2xl border border-violet-200 px-3 py-2 text-xs font-black text-violet-700 transition hover:bg-violet-50"
        >
          Entendi correções
        </button>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Se o cliente perceber algum erro nos dados do pré-contrato, ele poderá solicitar uma correção. Quando isso acontecer, a assinatura fica bloqueada até o admin revisar e liberar. Nesta simulação, não envie uma solicitação agora para não bloquear o fluxo.
      </p>
    </aside>
  );
}

function getGuideSpotlightClass(isActive) {
  if (!isActive) return '';
  return 'relative z-30 rounded-[2rem] ring-4 ring-violet-400/70 shadow-[0_0_0_9999px_rgba(15,23,42,0.30),0_24px_70px_rgba(109,40,217,0.35)] transition-all';
}

function AlertCard({ tone = 'default', title, children }) {
  const tones = {
    default: 'border-slate-200 bg-slate-50 text-slate-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    red: 'border-red-200 bg-red-50 text-red-800',
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone] || tones.default}`}>
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function getInputTone(error, success) {
  if (error) {
    return 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100';
  }

  if (success) {
    return 'border-emerald-300 bg-emerald-50 focus:border-emerald-400 focus:ring-emerald-100';
  }

  return '';
}

const RESOLVED_ADJUSTMENT_STATUSES = new Set([
  'resolved',
  'corrected',
  'released',
  'liberado',
]);

function getEffectiveAdjustmentValue({ saved, latestAdjustment }) {
  const latestAdjustmentStatus = String(latestAdjustment?.status || '').trim().toLowerCase();
  const rawSavedAdjustment = String(saved?.adjustment_request || '');
  const pendingAdjustmentMessage = String(latestAdjustment?.request_message || '');

  const textareaInitialValue =
    latestAdjustmentStatus === 'pending'
      ? pendingAdjustmentMessage || rawSavedAdjustment
      : rawSavedAdjustment;

  if (RESOLVED_ADJUSTMENT_STATUSES.has(latestAdjustmentStatus)) {
    return '';
  }

  return textareaInitialValue;
}

function getInitialFormFromSavedData({ saved, precontract, effectiveAdjustmentValue }) {
  return {
    full_name: saved.full_name || precontract.client_name || '',
    marital_status: saved.marital_status || '',
    profession: saved.profession || '',
    cpf: saved.cpf ? maskCpf(saved.cpf) : '',
    rg: saved.rg || '',
    whatsapp: saved.whatsapp ? maskPhone(saved.whatsapp) : '',

    address_street: saved.address_street || '',
    address_number: saved.address_number || '',
    address_complement: saved.address_complement || '',
    address_neighborhood: saved.address_neighborhood || '',
    address_cep: saved.address_cep ? maskCep(saved.address_cep) : '',
    address_city: saved.address_city || '',
    address_state: saved.address_state || '',

    event_date: convertDateToBr(saved.event_date || precontract.event_date || ''),
    event_time: normalizeTimeStrict(saved.event_time || precontract.event_time || ''),
    event_location_name: saved.event_location_name || precontract.location_name || '',
    event_location_address: saved.event_location_address || precontract.location_address || '',

    adjustment_request: effectiveAdjustmentValue,

    signer_name: saved.signer_name || '',
    signer_cpf: saved.signer_cpf ? maskCpf(saved.signer_cpf) : '',
    accepted_terms: !!saved.accepted_terms,
  };
}

async function upsertContactFromSignature({
  supabase,
  precontract,
  form,
}) {
  function isMissingContactTypeColumnError(error) {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('contact_type') && message.includes('contacts');
  }

  const email = String(precontract?.client_email || '').trim() || null;
  const phone = cleanDigits(form.whatsapp) || null;
  const name = String(form.full_name || '').trim();

  let existing = null;

  if (email) {
    const { data } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    existing = data || null;
  }

  if (!existing && phone) {
    const { data } = await supabase
      .from('contacts')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    existing = data || null;
  }

  const payload = {
    name: name || null,
    email,
    phone,
    tag: 'cliente',
    contact_type: 'client',
    notes: [
      'Criado/atualizado automaticamente após assinatura.',
      precontract?.event_type ? `Tipo: ${precontract.event_type}` : '',
      precontract?.formation ? `Formação: ${precontract.formation}` : '',
    ]
      .filter(Boolean)
      .join(' | '),
    is_active: true,
  };

  if (existing?.id) {
    let { error } = await supabase
      .from('contacts')
      .update(payload)
      .eq('id', existing.id);

    if (error && isMissingContactTypeColumnError(error)) {
      const safePayload = { ...payload };
      delete safePayload.contact_type;
      const retry = await supabase
        .from('contacts')
        .update(safePayload)
        .eq('id', existing.id);
      error = retry.error || null;
    }

    if (error) throw error;

    return existing.id;
  }

  let { data, error } = await supabase
    .from('contacts')
    .insert([payload])
    .select('id')
    .single();

  if (error && isMissingContactTypeColumnError(error)) {
    const safePayload = { ...payload };
    delete safePayload.contact_type;
    const retry = await supabase
      .from('contacts')
      .insert([safePayload])
      .select('id')
      .single();
    data = retry.data || null;
    error = retry.error || null;
  }

  if (error) throw error;

  return data.id;
}

async function upsertEventFromSignature({
  supabase,
  precontract,
  contactId,
  form,
}) {
  const { data: financeDefaults } = await supabase
    .from('finance_cost_defaults')
    .select('musician_unit_cost, sound_default_cost, transport_default_cost, other_default_cost, custom_costs')
    .eq('slug', 'default')
    .maybeSingle();

  const automaticCosts = getAutomaticCosts({
    formation: precontract?.formation,
    hasSound: !!precontract?.has_sound,
    hasTransport: !!precontract?.has_transport,
    transportPrice: precontract?.add_transport || 0,
    pricing: financeDefaults || {},
  });
  const agreedAmount = Number(precontract?.agreed_amount || 0);
  const totalCosts =
    Number(automaticCosts.musicianCost || 0) +
    Number(automaticCosts.soundCost || 0) +
    Number(automaticCosts.extraTransportCost || 0) +
    Number(automaticCosts.otherCost || 0);
  const profitAmount = agreedAmount - totalCosts;

  let existing = null;
  let matchReason = '';

  const legacyId = String(precontract?.legacy_id || '').trim();

  const normalizeFingerprintValue = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const safeDate = convertDateToInput(form.event_date) || precontract?.event_date || null;
  const safeTime = normalizeTimeStrict(form.event_time) || normalizeTimeStrict(precontract?.event_time) || null;
  const safeClientName =
    String(form.full_name || precontract?.client_name || '').trim() || null;
  const safeLocationName =
    String(form.event_location_name || precontract?.location_name || '').trim() || null;
  const safeLocationAddress =
    String(form.event_location_address || precontract?.location_address || '').trim() || null;

  const precontractEventId = precontract?.event_id || null;

  if (precontractEventId) {
    const { data } = await supabase
      .from('events')
      .select('id, observations')
      .eq('id', precontractEventId)
      .maybeSingle();

    if (data?.id) {
      existing = data;
      matchReason = 'MATCH_BY_PRECONTRACT_EVENT_ID';
      console.info('[EVENT_UPSERT][MATCH_BY_PRECONTRACT_EVENT_ID]', {
        precontract_id: precontract?.id || null,
        event_id: data.id,
      });
    }
  }

  if (!existing && legacyId) {
    const { data } = await supabase
      .from('events')
      .select('id, observations')
      .eq('legacy_id', legacyId)
      .maybeSingle();

    if (data?.id) {
      existing = data;
      matchReason = 'MATCH_BY_LEGACY_ID';
      console.info('[EVENT_UPSERT][MATCH_BY_LEGACY_ID]', {
        precontract_id: precontract?.id || null,
        event_id: data.id,
        legacy_id: legacyId,
      });
    }
  }

  if (!existing && safeClientName && safeDate && safeTime && (safeLocationName || safeLocationAddress)) {
    const normalizedFingerprint = {
      client_name: normalizeFingerprintValue(safeClientName),
      event_date: safeDate,
      event_time: safeTime,
      location_name: normalizeFingerprintValue(safeLocationName),
      location_address: normalizeFingerprintValue(safeLocationAddress),
    };

    const { data: candidates } = await supabase
      .from('events')
      .select('id, observations, client_name, event_date, event_time, location_name, location_address')
      .eq('event_date', safeDate)
      .eq('event_time', safeTime)
      .limit(20);

    const matchedByFingerprint = (candidates || []).find((candidate) => {
      const candidateClient = normalizeFingerprintValue(candidate?.client_name);
      const candidateLocationName = normalizeFingerprintValue(candidate?.location_name);
      const candidateLocationAddress = normalizeFingerprintValue(candidate?.location_address);

      if (!candidateClient || candidateClient !== normalizedFingerprint.client_name) return false;

      const locationByName =
        normalizedFingerprint.location_name &&
        candidateLocationName &&
        normalizedFingerprint.location_name === candidateLocationName;

      const locationByAddress =
        normalizedFingerprint.location_address &&
        candidateLocationAddress &&
        normalizedFingerprint.location_address === candidateLocationAddress;

      return Boolean(locationByName || locationByAddress);
    });

    if (matchedByFingerprint?.id) {
      existing = {
        id: matchedByFingerprint.id,
        observations: matchedByFingerprint.observations || null,
      };
      matchReason = 'MATCH_BY_FINGERPRINT';
      console.info('[EVENT_UPSERT][MATCH_BY_FINGERPRINT]', {
        precontract_id: precontract?.id || null,
        event_id: matchedByFingerprint.id,
      });
    }
  }

  const payload = {
    client_contact_id: contactId || null,
    client_name: safeClientName,

    event_type: precontract?.event_type || null,
    event_date: safeDate,
    event_time: safeTime,
    duration_min: Number(precontract?.duration_min || 60),

    location_name: safeLocationName,
    location_address: safeLocationAddress,

    formation: precontract?.formation || null,
    instruments: precontract?.instruments || null,
    reception_formation: precontract?.reception_formation || null,
    reception_instruments: precontract?.reception_instruments || null,

    has_sound: !!precontract?.has_sound,
    reception_hours: Number(precontract?.reception_hours || 0),
    reception_formation: precontract?.reception_formation || null,
    reception_instruments: precontract?.reception_instruments || null,
    has_transport: !!precontract?.has_transport,

    transport_cost: Number(precontract?.add_transport || 0),
    base_amount: Number(precontract?.base_amount || 0),

    agreed_amount: agreedAmount,
    gross_amount: agreedAmount,
    net_amount: profitAmount,
    profit_amount: profitAmount,
    musician_cost: Number(automaticCosts.musicianCost || 0),
    sound_cost: Number(automaticCosts.soundCost || 0),
    extra_transport_cost: Number(automaticCosts.extraTransportCost || 0),
    other_cost: Number(automaticCosts.otherCost || 0),
    cost_breakdown: automaticCosts.costBreakdown,
    costs_source: 'default',

    whatsapp_name: String(form.full_name || '').trim() || null,
    whatsapp_phone: cleanDigits(form.whatsapp) || null,

    observations: existing?.observations || null,
    notes: [
      'Criado/atualizado automaticamente após assinatura.',
      precontract?.notes || '',
    ]
      .filter(Boolean)
      .join('\n\n'),

    status: 'Confirmado',
    legacy_id: legacyId || null,
    ...(precontract?.is_demo === true || precontract?.source === 'onboarding_demo' || precontract?.metadata?.is_onboarding_demo === true
      ? {
          is_demo: true,
          source: 'onboarding_demo',
          metadata: { ...(precontract?.metadata || {}), is_onboarding_demo: true, onboarding_step: 'client_contract_signed' },
        }
      : {}),
  };

  let finalEventId = null;

  if (existing?.id) {
    const { error } = await supabase
      .from('events')
      .update(payload)
      .eq('id', existing.id);

    if (error) throw error;
    finalEventId = existing.id;
    console.info('[EVENT_UPSERT][UPDATE_EXISTING]', {
      precontract_id: precontract?.id || null,
      event_id: finalEventId,
      matched_by: matchReason || 'UNKNOWN',
    });
  } else {
    console.info('[EVENT_UPSERT][INSERT_NEW]', {
      precontract_id: precontract?.id || null,
      legacy_id: legacyId || null,
    });

    const { data, error } = await supabase
      .from('events')
      .insert([payload])
      .select('id')
      .single();

    if (error) throw error;
    finalEventId = data.id;
  }

  if (precontract?.id && finalEventId) {
    const { error: precontractUpdateError } = await supabase
      .from('precontracts')
      .update({ event_id: finalEventId })
      .eq('id', precontract.id);

    if (precontractUpdateError) throw precontractUpdateError;

    const { data: relatedContract, error: relatedContractError } = await supabase
      .from('contracts')
      .select('id, event_id')
      .eq('precontract_id', precontract.id)
      .maybeSingle();

    if (relatedContractError) throw relatedContractError;

    if (relatedContract?.id) {
      const { error: contractEventUpdateError } = await supabase
        .from('contracts')
        .update({ event_id: finalEventId })
        .eq('id', relatedContract.id);

      if (contractEventUpdateError) throw contractEventUpdateError;
    }
  }

  return finalEventId;
}

export default function ContratoPublicoPage() {
  const toast = useAppToast();
  const params = useParams();
  const searchParams = useSearchParams();
  const token = useMemo(() => {
    if (Array.isArray(params?.token)) {
      return String(params.token[0] || '').trim();
    }
    return String(params?.token || '').trim();
  }, [params]);
  const guideQueryValue = searchParams.get('guide');
  const isClientContractGuideActive =
    guideQueryValue === CLIENT_CONTRACT_GUIDE_QUERY_VALUE;
  const isClientContractSuccessGuideActive =
    guideQueryValue === CLIENT_CONTRACT_GUIDE_QUERY_VALUE ||
    guideQueryValue === CLIENT_CONTRACT_SUCCESS_GUIDE_QUERY_VALUE;
  const [guideVisible, setGuideVisible] = useState(isClientContractGuideActive);
  const [successGuideVisible, setSuccessGuideVisible] = useState(isClientContractSuccessGuideActive);
  const [guideCorrectionExplained, setGuideCorrectionExplained] = useState(false);
  const [previewAberto, setPreviewAberto] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [viewedAt, setViewedAt] = useState('');

  const [precontract, setPrecontract] = useState(null);
  const [contract, setContract] = useState(null);
  const [contactData, setContactData] = useState(null);
  const [eventData, setEventData] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [draftStatus, setDraftStatus] = useState('idle');
  const [enviado, setEnviado] = useState(false);
  const [solicitandoAjuste, setSolicitandoAjuste] = useState(false);
  const [pendingAdjustmentRequest, setPendingAdjustmentRequest] = useState(null);
  const hasPendingAdjustment =
  pendingAdjustmentRequest?.id &&
  String(pendingAdjustmentRequest?.status || '').toLowerCase() === 'pending';

  const [form, setForm] = useState(getInitialForm());
  const [resultadoFinal, setResultadoFinal] = useState({
    pdfUrl: '',
    docUrl: '',
    html: '',
    clientPanelUrl: '',
    documentHash: '',
    missingColumns: [],
  });
  const [internalPdfStatus, setInternalPdfStatus] = useState('idle');
  const [signatureStep, setSignatureStep] = useState('');

  const addressStreetRef = useRef(null);
const eventAddressRef = useRef(null);
  const clientAutocompleteRef = useRef(null);
  const eventAutocompleteRef = useRef(null);
  const pdfReadyLoggedRef = useRef('');

const mapsLoaded = useGoogleMapsReady();

  const [fieldErrors, setFieldErrors] = useState({});
  const [addressValidation, setAddressValidation] = useState({
    clientAddressConfirmed: false,
    eventAddressConfirmed: false,
  });
  const [clientAddressStatus, setClientAddressStatus] = useState('idle'); // 'idle' | 'typing' | 'selected' | 'fallback'
  const [eventAddressStatus, setEventAddressStatus] = useState('idle');   // 'idle' | 'typing' | 'selected' | 'fallback'
  const autosaveTimerRef = useRef(null);

  useEffect(() => {
    if (isClientContractGuideActive) {
      setGuideVisible(true);
    }
    if (isClientContractSuccessGuideActive) {
      setSuccessGuideVisible(true);
    }
  }, [isClientContractGuideActive, isClientContractSuccessGuideActive]);
  const isInternalMode =
    precontract?.custom_contract_enabled === true ||
    precontract?.contract_mode === 'internal';

  const savedClientForm = useMemo(() => contract?.raw_payload?.client_form || {}, [contract]);
  const contractViewedAt = useMemo(
    () => viewedAt || contract?.raw_payload?.contract_viewed_at || '',
    [viewedAt, contract]
  );

  const markContractViewed = useCallback(async () => {
    const nowIso = new Date().toISOString();
    setViewedAt((prev) => prev || nowIso);
    if (isClientContractGuideActive) return;
    if (!contract?.id) return;
    const rawPayload = {
      ...(contract?.raw_payload || {}),
      contract_viewed_at: contract?.raw_payload?.contract_viewed_at || nowIso,
      contract_viewed_from_public_page: true,
    };
    const { error } = await supabase.from('contracts').update({ raw_payload: rawPayload }).eq('id', contract.id);
    if (error) {
      console.warn('Falha ao salvar visualização de contrato', error);
    } else {
      setContract((prev) => (prev ? { ...prev, raw_payload: rawPayload } : prev));
    }
  }, [contract, isClientContractGuideActive]);

  const contextTemplateData = useMemo(
    () => buildContractTemplateData({
      contract,
      precontract,
      contact: contactData,
      event: eventData,
    }),
    [contract, precontract, contactData, eventData]
  );

  const formTemplateData = useMemo(() => {
    const eventDate = convertDateToBr(form.event_date);
    const eventTime = normalizeTimeStrict(form.event_time);
    const eventLocation = [form.event_location_name, form.event_location_address]
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .join(' - ');

    return {
      client_name: form.full_name,
      client_marital_status: form.marital_status,
      client_profession: form.profession,
      client_cpf: form.cpf,
      client_rg: form.rg,
      client_address: buildClientAddress(form),
      event_date: eventDate,
      event_time: eventTime,
      event_location: eventLocation,
      client_signature: form.signer_name,
      accepted_name: form.signer_name,
      accepted_cpf: form.signer_cpf,
      NOME: form.full_name,
      ESTADO_CIVIL: form.marital_status,
      PROFISSAO: form.profession,
      CPF: form.cpf,
      RG: form.rg,
      ENDERECO: buildClientAddress(form),
      DATA_EVENTO: eventDate,
      HORA_EVENTO: eventTime,
      LOCAL_EVENTO: eventLocation,
      ASSINATURA: form.signer_name,
      ACEITE_NOME: form.signer_name,
      ACEITE_CPF: form.signer_cpf,
    };
  }, [form]);

  const savedFormTemplateData = useMemo(() => {
    const eventLocation = [savedClientForm?.event_location_name, savedClientForm?.event_location_address]
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .join(' - ');

    return {
      client_name: savedClientForm?.full_name,
      client_marital_status: savedClientForm?.marital_status,
      client_profession: savedClientForm?.profession,
      client_cpf: savedClientForm?.cpf,
      client_rg: savedClientForm?.rg,
      client_address: buildClientAddress(savedClientForm),
      event_date: convertDateToBr(savedClientForm?.event_date),
      event_time: normalizeTimeStrict(savedClientForm?.event_time),
      event_location: eventLocation,
      client_signature: savedClientForm?.signer_name,
      accepted_name: savedClientForm?.signer_name,
      accepted_cpf: savedClientForm?.signer_cpf,
      NOME: savedClientForm?.full_name,
      ESTADO_CIVIL: savedClientForm?.marital_status,
      PROFISSAO: savedClientForm?.profession,
      CPF: savedClientForm?.cpf,
      RG: savedClientForm?.rg,
      ENDERECO: buildClientAddress(savedClientForm),
      DATA_EVENTO: convertDateToBr(savedClientForm?.event_date),
      HORA_EVENTO: normalizeTimeStrict(savedClientForm?.event_time),
      LOCAL_EVENTO: eventLocation,
      ASSINATURA: savedClientForm?.signer_name,
      ACEITE_NOME: savedClientForm?.signer_name,
      ACEITE_CPF: savedClientForm?.signer_cpf,
    };
  }, [savedClientForm]);

  const previewTemplateData = useMemo(
    () => mergeTemplateDataPriority(contextTemplateData, savedFormTemplateData, formTemplateData),
    [contextTemplateData, savedFormTemplateData, formTemplateData]
  );

  function resolveContractHtml() {
    const candidates = [
      precontract?.custom_contract_rich_html,
      precontract?.custom_contract_content,
      previewHtml,
      contract?.raw_payload?.signed_contract_html,
      contract?.raw_payload?.contract_html_snapshot,
      contract?.raw_payload?.contract_html,
      contract?.raw_payload?.generated_contract?.html,
    ];

    const resolved = candidates.find((item) => String(item || '').trim().length > 0);
    const sourceHtml = String(resolved || '').trim();
    if (!sourceHtml) return '';

    return renderContractHtmlWithData(sourceHtml, previewTemplateData);
  }

  function abrirPreviewContrato() {
    if (!token) {
      toast.error('Token do contrato não encontrado.');
      return;
    }

    if (isInternalMode && !resolveContractHtml()) {
      toast.warning('Contrato interno ainda não disponível para visualização.');
      return;
    }

    setPreviewError('');
    const contratoHtmlResolvido = resolveContractHtml();
    if (isInternalMode) {
      if (!contratoHtmlResolvido) {
        toast.error('Não foi possível gerar a visualização do contrato.');
        return;
      }
      setPreviewLoading(false);
      setPreviewAberto(true);
      markContractViewed().catch(() => null);
      return;
    }

    setPreviewLoading(true);
    setPreviewAberto(true);
    fetch(`/api/contracts/preview-html/${token}`, {
      method: 'GET',
      cache: 'no-store',
    })
      .then(async (response) => {
        const html = await response.text();
        if (!response.ok) {
          throw new Error(html || 'Não foi possível carregar o contrato.');
        }
        setPreviewHtml(String(html || '').trim());
        markContractViewed().catch(() => null);
      })
      .catch((error) => {
        setPreviewHtml('');
        setPreviewError(error?.message || 'Erro ao carregar contrato.');
      })
      .finally(() => {
        setPreviewLoading(false);
      });
  }

  const fetchLegacyContract = useCallback(async () => {
    if (!token) {
      throw new Error('Token do contrato não encontrado.');
    }

    let precontractData = null;
    let contractData = null;

    const { data: preByToken, error: preByTokenError } = await supabase
      .from('precontracts')
      .select('*')
      .eq('public_token', token)
      .maybeSingle();
    if (preByTokenError) throw preByTokenError;
    precontractData = preByToken || null;

    if (!precontractData) {
      const { data: contractByToken, error: contractByTokenError } = await supabase
        .from('contracts')
        .select('*')
        .eq('public_token', token)
        .maybeSingle();
      if (contractByTokenError) throw contractByTokenError;
      contractData = contractByToken || null;

      if (contractData?.precontract_id) {
        const { data: preById, error: preByIdError } = await supabase
          .from('precontracts')
          .select('*')
          .eq('id', contractData.precontract_id)
          .maybeSingle();
        if (preByIdError) throw preByIdError;
        precontractData = preById || null;
      }
    }

    if (!precontractData) {
      return null;
    }

    if (!contractData && precontractData?.id) {
      const { data: contractByPreId, error: contractByPreIdError } = await supabase
        .from('contracts')
        .select('*')
        .eq('precontract_id', precontractData.id)
        .maybeSingle();
      if (contractByPreIdError) throw contractByPreIdError;
      contractData = contractByPreId || null;
    }

    const contactId = contractData?.contact_id || precontractData?.contact_id || null;
    const eventId = contractData?.event_id || precontractData?.event_id || null;
    let contact = null;
    let event = null;

    if (contactId) {
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .maybeSingle();
      if (contactError) {
        console.warn('[CONTRACT_PUBLIC_UI] falha não fatal ao buscar contact no legado', {
          token,
          contactId,
          message: contactError.message,
        });
      } else {
        contact = contactData || null;
      }
    }

    if (eventId) {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();
      if (eventError) {
        console.warn('[CONTRACT_PUBLIC_UI] falha não fatal ao buscar event no legado', {
          token,
          eventId,
          message: eventError.message,
        });
      } else {
        event = eventData || null;
      }
    }

    return normalizeContractData({
      precontract: precontractData,
      contract: contractData,
      contact,
      event,
    });
  }, [token]);

  const fetchContract = useCallback(async () => {
    let latest = null;
    try {
      latest = await fetchPublicContract(token);
      if (latest) {
        return latest.contract || null;
      }
      console.info('[CONTRACT_PUBLIC_UI][FALLBACK_TO_LEGACY]', { token, reason: 'not_found' });
    } catch (error) {
      console.warn('[CONTRACT_PUBLIC_UI][FALLBACK_TO_LEGACY]', { token, reason: error?.message || 'public_api_error' });
    }

    const legacy = await fetchLegacyContract();
    return legacy?.contract || null;
  }, [fetchLegacyContract, token]);

  const refetchContract = useCallback(async () => {
    let latest = null;
    try {
      latest = await fetchPublicContract(token);
      if (latest) {
        console.info('[CONTRACT_PUBLIC_UI][USING_PUBLIC_API]', { token });
      }
    } catch (error) {
      console.warn('[CONTRACT_PUBLIC_UI][FALLBACK_TO_LEGACY]', { token, reason: error?.message || 'public_api_error' });
    }

    if (!latest) {
      console.info('[CONTRACT_PUBLIC_UI][FALLBACK_TO_LEGACY]', { token, reason: 'empty_or_not_found' });
      latest = await fetchLegacyContract();
    }

    setPrecontract(sanitizeTimeFields(latest?.precontract || null));
    setContract(latest?.contract || null);
    setContactData(latest?.contact || null);
    setEventData(latest?.event || null);
    return latest || null;
  }, [fetchLegacyContract, token]);

  useEffect(() => {
  async function carregar() {
    if (!token) return;

    let safePreData = null;

    try {
      setCarregando(true);
      let preData = null;
      let contractData = null;

      console.info('[CONTRACT_PUBLIC_UI] token recebido na página pública', {
        token,
      });

      let latest = null;
      try {
        latest = await fetchPublicContract(token);
        if (latest) {
          console.info('[CONTRACT_PUBLIC_UI][USING_PUBLIC_API]', { token });
        }
      } catch (error) {
        console.warn('[CONTRACT_PUBLIC_UI][FALLBACK_TO_LEGACY]', {
          token,
          reason: error?.message || 'public_api_error',
        });
      }

      if (!latest) {
        console.info('[CONTRACT_PUBLIC_UI][FALLBACK_TO_LEGACY]', {
          token,
          reason: 'empty_or_not_found',
        });
        latest = await fetchLegacyContract();
      }

      preData = latest?.precontract || null;
      contractData = latest?.contract || null;
      const contactData = latest?.contact || null;
      const eventLoadedData = latest?.event || null;
      setContactData(contactData || null);
      setEventData(eventLoadedData || null);

      safePreData = sanitizeTimeFields(preData || null);
      setPrecontract(safePreData || null);
      setContract(contractData || null);

      const resolvedMode =
        safePreData?.custom_contract_enabled === true ||
        safePreData?.contract_mode === 'internal'
          ? 'internal'
          : 'docs';

      devLog('[CONTRACT_PUBLIC_UI] precontract encontrado', {
        token,
        precontractId: safePreData?.id || null,
      });
      devLog('[CONTRACT_PUBLIC_UI] mode resolvido', {
        token,
        mode: resolvedMode,
      });

      if (resolvedMode === 'internal') {
        const context = {
          precontract: safePreData || null,
          contract: contractData || null,
          contact: contactData || null,
          event: eventLoadedData || null,
        };

        const templateData = buildContractTemplateData(context);
        const precontractHtml = resolveContractHtmlSource(safePreData || {}).html;
        const resolvedHtml = renderContractHtmlWithData(precontractHtml, templateData);
        const internal = generateInternalContract(
          {
            ...context,
            precontract: {
              ...(safePreData || {}),
              custom_contract_content: resolvedHtml || precontractHtml,
            },
          },
          templateData
        );
        setPreviewHtml(String(internal?.html || '').trim());
      } else {
        setPreviewHtml('');
      }

      if (!safePreData?.id) {
        return;
      }

      if (!contractData) {
        try {
          const { data: contractByPreId, error: contractError } = await supabase
            .from('contracts')
            .select('*')
            .eq('precontract_id', safePreData.id)
            .maybeSingle();

          if (contractError) {
            console.warn('[CONTRACT_PUBLIC_UI] falha ao buscar contract por precontract_id', {
              token,
              precontractId: safePreData.id,
              message: contractError.message,
            });
          } else {
            contractData = contractByPreId || null;
            setContract(contractData || null);
          }
        } catch (error) {
          console.warn('[CONTRACT_PUBLIC_UI] erro não fatal ao buscar contract complementar', {
            token,
            precontractId: safePreData.id,
            message: error?.message,
          });
        }
      }

      let saved = contractData?.raw_payload?.client_form || {};
      try {
        const draftPayload = await fetchPublicContractDraft(token);
        if (draftPayload?.initial_form && typeof draftPayload.initial_form === 'object') {
          saved = { ...saved, ...draftPayload.initial_form };
        }
      } catch (error) {
        console.warn('[CONTRACT_PUBLIC_UI] falha não fatal ao carregar draft', {
          token,
          message: error?.message,
        });
      }

      let latestAdjustment = null;
      try {
        const { data: latestAdjustmentData, error: adjustmentError } = await supabase
          .from('contract_adjustment_requests')
          .select('id, precontract_id, status, request_message, created_at, resolved_at, resolved_note')
          .eq('precontract_id', safePreData.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (adjustmentError) {
          console.warn('[CONTRACT_PUBLIC_UI] falha não fatal ao buscar ajuste pendente', {
            token,
            precontractId: safePreData.id,
            message: adjustmentError.message,
          });
          setPendingAdjustmentRequest(null);
        } else {
          latestAdjustment = latestAdjustmentData || null;
          setPendingAdjustmentRequest(latestAdjustment);
        }
      } catch (error) {
        console.warn('[CONTRACT_PUBLIC_UI] erro não fatal ao buscar ajuste pendente', {
          token,
          precontractId: safePreData.id,
          message: error?.message,
        });
        setPendingAdjustmentRequest(null);
      }

      const effectiveAdjustmentValue = getEffectiveAdjustmentValue({
        saved,
        latestAdjustment,
      });

      setForm(
        getInitialFormFromSavedData({
          saved,
          precontract: safePreData,
          effectiveAdjustmentValue,
        })
      );

      setAddressValidation({
        clientAddressConfirmed: !!saved.address_street,
        eventAddressConfirmed: !!saved.event_location_address,
      });

      if (saved.address_street) setClientAddressStatus('selected');
      if (saved.event_location_address) setEventAddressStatus('selected');

      if (!safePreData.public_token) {
        try {
          await supabase
            .from('precontracts')
            .update({
              public_token: String(token).trim(),
            })
            .eq('id', safePreData.id);
        } catch (error) {
          console.warn('[CONTRACT_PUBLIC_UI] falha não fatal ao atualizar public_token', {
            token,
            precontractId: safePreData.id,
            message: error?.message,
          });
        }
      }

      if (safePreData?.status === 'link_generated') {
        try {
          await supabase
            .from('precontracts')
            .update({ status: 'client_filling' })
            .eq('id', safePreData.id);

          setPrecontract((prev) =>
            prev ? { ...prev, status: 'client_filling' } : prev
          );
        } catch (error) {
          console.warn('[CONTRACT_PUBLIC_UI] falha não fatal ao atualizar status para client_filling', {
            token,
            precontractId: safePreData.id,
            message: error?.message,
          });
        }
      }
    } catch (error) {
      console.error('Erro ao carregar contrato público:', error);

      if (!safePreData?.id) {
        setPrecontract(null);
      }
    } finally {
      setCarregando(false);
    }
  }

  carregar();
}, [token, fetchLegacyContract]);

useEffect(() => {
  if (!token) return undefined;
  const hasSignedContract =
    contract?.status === 'signed' || precontract?.status === 'signed' || enviado;
  if (!hasSignedContract) return undefined;
  if (resultadoFinal.pdfUrl || contract?.pdf_url) return undefined;

  const interval = setInterval(async () => {
    try {
      const latest = await refetchContract();
      const latestPdfUrl = latest?.contract?.pdf_url || '';
      if (latestPdfUrl) {
        setResultadoFinal((prev) => ({
          ...prev,
          pdfUrl: prev.pdfUrl || latestPdfUrl,
        }));
        clearInterval(interval);
      }
    } catch (error) {
      console.warn('[CONTRACT_PUBLIC_UI] polling pdf_url falhou', {
        token,
        message: error?.message,
      });
    }
  }, 3000);

  return () => clearInterval(interval);
}, [
  token,
  enviado,
  precontract?.status,
  contract?.status,
  resultadoFinal.pdfUrl,
  contract?.pdf_url,
  refetchContract,
]);

useEffect(() => {
  const signedContract =
    contract?.status === 'signed' || precontract?.status === 'signed';
  const pdfUrl = resultadoFinal.pdfUrl || contract?.pdf_url || '';
  if (!token || !signedContract || !pdfUrl) return;

  const fingerprint = `${token}:${pdfUrl}`;
  if (pdfReadyLoggedRef.current === fingerprint) return;
  pdfReadyLoggedRef.current = fingerprint;

  console.info('[CONTRACT_PUBLIC_UI][PDF_READY]', {
    token,
    contractId: contract?.id || null,
    precontractId: precontract?.id || null,
    pdfUrl,
  });
}, [
  token,
  contract?.id,
  contract?.status,
  contract?.pdf_url,
  precontract?.id,
  precontract?.status,
  resultadoFinal.pdfUrl,
]);

 useEffect(() => {
  if (!mapsLoaded) return;
  if (typeof window === 'undefined') return;

  let attempts = 0;
  let intervalId = null;

  function initAutocomplete() {
    attempts += 1;

    const places = window.google?.maps?.places;
    const clientInput = addressStreetRef.current;
    const eventInput = eventAddressRef.current;

    devLog('[Google Maps] tentativa de inicialização', {
      attempts,
      placesReady: !!places,
      hasClientInput: !!clientInput,
      hasEventInput: !!eventInput,
    });

    if (!places || !clientInput || !eventInput) {
      if (attempts >= 20) {
        console.warn('[Google Maps] Não foi possível inicializar autocomplete após várias tentativas.');
        setClientAddressStatus('fallback');
        setEventAddressStatus('fallback');
        if (intervalId) clearInterval(intervalId);
      }
      return;
    }

    if (!clientAutocompleteRef.current) {
      clientAutocompleteRef.current = new window.google.maps.places.Autocomplete(
        clientInput,
        {
          componentRestrictions: { country: 'br' },
          fields: ['formatted_address', 'address_components'],
          types: ['address'],
        }
      );

      clientAutocompleteRef.current.addListener('place_changed', () => {
        const place = clientAutocompleteRef.current.getPlace();
        const data = extractAddressDataFromPlace(place);

        setForm((prev) => ({
          ...prev,
          address_street: data.street || data.formattedAddress || '',
          address_number: data.number ?? '',
          address_neighborhood: data.neighborhood || '',
          address_cep: data.cep || '',
          address_city: data.city || '',
          address_state: data.state || '',
        }));

        setAddressValidation((prev) => ({
          ...prev,
          clientAddressConfirmed: !!(data.street || data.formattedAddress)
        }));

        setClientAddressStatus('selected');

        setFieldErrors((prev) => ({
          ...prev,
          address_street: '',
          address_number: '',
          address_neighborhood: '',
          address_cep: '',
          address_city: '',
          address_state: '',
        }));
      });
    }

    if (!eventAutocompleteRef.current) {
      eventAutocompleteRef.current = new window.google.maps.places.Autocomplete(
        eventInput,
        {
          componentRestrictions: { country: 'br' },
          fields: ['formatted_address'],
          types: ['address'],
        }
      );

      eventAutocompleteRef.current.addListener('place_changed', () => {
        const place = eventAutocompleteRef.current.getPlace();
        const formattedAddress = place?.formatted_address || '';

        setForm((prev) => ({
          ...prev,
          event_location_address:
            formattedAddress || prev.event_location_address,
        }));

        setAddressValidation((prev) => ({
          ...prev,
          eventAddressConfirmed: !!formattedAddress,
        }));

        setEventAddressStatus('selected');

        setFieldErrors((prev) => ({
          ...prev,
          event_location_address: '',
        }));
      });
    }

    if (clientAutocompleteRef.current && eventAutocompleteRef.current) {
      devLog('[Google Maps] autocomplete inicializado com sucesso');
      clearInterval(intervalId);
    }
  }

  intervalId = setInterval(initAutocomplete, 300);
  initAutocomplete();

  return () => {
    if (intervalId) clearInterval(intervalId);

    try {
      if (clientAutocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(clientAutocompleteRef.current);
      }
      if (eventAutocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(eventAutocompleteRef.current);
      }
    } catch {
      // ignore cleanup errors
    }

    clientAutocompleteRef.current = null;
    eventAutocompleteRef.current = null;
  };
}, [mapsLoaded]);
  
  function handleChange(field, value) {
    let nextValue = value;

    if (field === 'cpf' || field === 'signer_cpf') {
      nextValue = maskCpf(value);
    }

    if (field === 'whatsapp') {
      nextValue = maskPhone(value);
    }

    if (field === 'address_cep') {
      nextValue = maskCep(value);
    }

    if (field === 'event_date') {
      nextValue = maskDate(value);
    }

    if (field === 'event_time') {
      nextValue = normalizeTimeStrict(maskTime(value));
    }

    setForm((prev) => ({
      ...prev,
      [field]: nextValue,
    }));

    setFieldErrors((prev) => ({
      ...prev,
      [field]: '',
    }));

    if (field === 'address_street') {
      setAddressValidation((prev) => ({
        ...prev,
        clientAddressConfirmed: false,
      }));

      setClientAddressStatus(
        nextValue.trim() === '' ? 'idle' : 'typing'
      );
    }

    if (field === 'event_location_address') {
      setAddressValidation((prev) => ({
        ...prev,
        eventAddressConfirmed: false,
      }));

      setEventAddressStatus(
        nextValue.trim() === '' ? 'idle' : 'typing'
      );
    }
  }

  const resumo = useMemo(() => {
    if (!precontract) return null;

    return {
      clientName: precontract.client_name || '',
      eventType: precontract.event_type || '',
      eventDate: precontract.event_date || '',
      eventTime: normalizeTimeStrict(precontract.event_time || ''),
      formation: precontract.formation || '',
      instruments: precontract.instruments || '',
      receptionFormation: precontract.reception_formation || '',
      receptionInstruments: precontract.reception_instruments || '',
      locationName: precontract.location_name || '',
      locationAddress: precontract.location_address || '',
      receptionHours: precontract.reception_hours || 0,
      receptionFormation: precontract.reception_formation || '',
      receptionInstruments: precontract.reception_instruments || '',
      hasSound: !!precontract.has_sound,
      hasTransport: !!precontract.has_transport,
      agreedAmount: precontract.agreed_amount || 0,
      notes: precontract.notes || '',
      status: precontract.status || 'draft',
    };
  }, [precontract]);

useEffect(() => {
  if (!previewAberto) return undefined;

  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  return () => {
    document.body.style.overflow = originalOverflow;
  };
}, [previewAberto]);

const pdfDisponivel =
  !!resultadoFinal.pdfUrl || !!contract?.pdf_url;
const contratoHtmlResolvido = resolveContractHtml();
const internalSnapshotDisponivel =
  isInternalMode &&
  !!(resultadoFinal.html || contratoHtmlResolvido);

const contratoFinalizado =
  (contract?.status === 'signed' || precontract?.status === 'signed') &&
  (isInternalMode ? internalSnapshotDisponivel || pdfDisponivel : pdfDisponivel);
const canSubmitSignature =
  !!form.accepted_terms &&
  !!String(form.signer_name || '').trim() &&
  !!String(form.signer_cpf || '').trim() &&
  !salvando &&
  !hasPendingAdjustment;

const guideRequiredDataFilled = useMemo(() => {
  const checks = [
    String(form.full_name || '').trim(),
    String(form.marital_status || '').trim(),
    String(form.profession || '').trim(),
    String(form.rg || '').trim(),
    isValidCpf(form.cpf),
    isValidPhone(form.whatsapp),
    String(form.address_street || '').trim(),
    String(form.address_number || '').trim(),
    String(form.address_neighborhood || '').trim(),
    isValidCep(form.address_cep),
    String(form.address_city || '').trim(),
    String(form.address_state || '').trim(),
    isValidDateBr(form.event_date),
    isValidTime(form.event_time),
    String(form.event_location_name || '').trim(),
    String(form.event_location_address || '').trim(),
  ];

  return checks.every(Boolean);
}, [form]);

const guideSignatureReady =
  guideRequiredDataFilled &&
  String(form.signer_name || '').trim() &&
  isValidCpf(form.signer_cpf) &&
  !!form.accepted_terms &&
  !hasPendingAdjustment;

const guideSteps = useMemo(() => [
  {
    key: 'clientView',
    label: 'Entender a visão do cliente',
    description: 'Você está navegando como o cliente vê o contrato público.',
    hint: 'Explique ao admin que esta tela é exatamente a experiência pública do cliente antes da assinatura.',
    done: true,
  },
  {
    key: 'contractViewed',
    label: 'Visualizar contrato completo',
    description: 'Abra a prévia para simular a leitura do documento antes do aceite.',
    hint: 'Clique em “Visualizar contrato” e percorra o conteúdo geral antes de continuar.',
    done: !!contractViewedAt || previewAberto,
  },
  {
    key: 'requiredDataFilled',
    label: 'Preencher dados obrigatórios',
    description: 'Use dados fictícios de teste para demonstrar o preenchimento sem microgerenciar cada campo.',
    hint: `Preencha dados fictícios, como Cliente Teste, Solteiro, Empresário, CPF ${GUIDE_TEST_CPF}, Rua Teste, 123 e Salvador/BA.`,
    done: guideRequiredDataFilled,
  },
  {
    key: 'correctionAreaExplained',
    label: 'Explicar Solicitar correção',
    description: 'Mostre que uma solicitação bloqueia assinatura até revisão do admin.',
    hint: 'Destaque “Solicitar correção”: se o cliente apontar erro, a assinatura fica bloqueada e o admin é avisado no WhatsApp e no dashboard.',
    done: guideCorrectionExplained,
  },
  {
    key: 'signatureReady',
    label: 'Preparar assinatura',
    description: 'Preencha nome/CPF da assinatura e marque o aceite para liberar o botão.',
    hint: 'Agora destaque a assinatura eletrônica: use Cliente Teste, o CPF de teste e marque o aceite.',
    done: guideSignatureReady,
  },
  {
    key: 'signed',
    label: 'Confirmar assinatura',
    description: 'Finalize a simulação para mostrar que o contrato assinado libera o operacional no app.',
    hint: 'Clique em “Assinar contrato”. Neste guia, a assinatura é simulada e não dispara automações reais.',
    done: enviado || contratoFinalizado,
  },
], [contractViewedAt, contratoFinalizado, enviado, guideCorrectionExplained, guideRequiredDataFilled, guideSignatureReady, previewAberto]);

const currentGuideSpotlight = useMemo(() => {
  if (!isClientContractGuideActive) return '';
  if (!contractViewedAt && !previewAberto) return 'contractViewer';
  if (!guideRequiredDataFilled) return 'clientData';
  if (!guideCorrectionExplained) return 'correction';
  if (!guideSignatureReady) return 'signature';
  if (!enviado && !contratoFinalizado) return 'signButton';
  return 'done';
}, [contractViewedAt, contratoFinalizado, enviado, guideCorrectionExplained, guideRequiredDataFilled, guideSignatureReady, isClientContractGuideActive, previewAberto]);

function preencherDadosDoGuia() {
  setForm((prev) => ({
    ...prev,
    full_name: 'Cliente Teste',
    marital_status: 'Solteiro',
    profession: 'Empresário',
    cpf: GUIDE_TEST_CPF,
    rg: '12.345.678-9',
    whatsapp: '(71) 99999-9999',
    address_street: 'Rua Teste',
    address_number: '123',
    address_neighborhood: 'Centro',
    address_cep: '40000-000',
    address_city: 'Salvador',
    address_state: 'BA',
    event_date: prev.event_date || convertDateToBr(precontract?.event_date || '') || '31/12/2026',
    event_time: prev.event_time || normalizeTimeStrict(precontract?.event_time || '') || '19:00',
    event_location_name: prev.event_location_name || precontract?.location_name || 'Local Teste',
    event_location_address: prev.event_location_address || precontract?.location_address || 'Rua Teste, 123 - Salvador/BA',
    signer_name: 'Cliente Teste',
    signer_cpf: GUIDE_TEST_CPF,
  }));
  setAddressValidation({ clientAddressConfirmed: true, eventAddressConfirmed: true });
  setClientAddressStatus('selected');
  setEventAddressStatus('selected');
  setFieldErrors({});
  toast.success('Dados fictícios aplicados apenas nesta simulação.');
}
  function validateFormFields() {
    const errors = {};

    if (!form.full_name.trim()) errors.full_name = 'Informe o nome completo.';
    if (!form.marital_status.trim()) errors.marital_status = 'Informe o estado civil.';
    if (!form.profession.trim()) errors.profession = 'Informe a profissão.';
    if (!form.rg.trim()) errors.rg = 'Informe o RG.';

    if (!form.cpf.trim()) {
      errors.cpf = 'Informe o CPF.';
    } else if (!isValidCpf(form.cpf)) {
      errors.cpf = 'CPF inválido.';
    }

    if (!form.whatsapp.trim()) {
      errors.whatsapp = 'Informe o WhatsApp.';
    } else if (!isValidPhone(form.whatsapp)) {
      errors.whatsapp = 'WhatsApp inválido.';
    }

    if (!form.address_street.trim()) {
      errors.address_street = 'Informe o endereço.';
    }

    if (!form.address_neighborhood.trim()) {
      errors.address_neighborhood = 'Informe o bairro.';
    }

    if (!form.address_cep.trim()) {
      errors.address_cep = 'Informe o CEP.';
    } else if (!isValidCep(form.address_cep)) {
      errors.address_cep = 'CEP inválido.';
    }

    if (!form.address_city.trim()) {
      errors.address_city = 'Informe a cidade.';
    }

    if (!form.address_state.trim()) {
      errors.address_state = 'Informe o estado.';
    }

    if (!form.event_date.trim()) {
      errors.event_date = 'Informe a data do evento.';
    } else if (!isValidDateBr(form.event_date)) {
      errors.event_date = 'Data inválida.';
    }

    if (!form.event_time.trim()) {
      errors.event_time = 'Informe o horário do evento.';
    } else if (!isValidTime(form.event_time)) {
      errors.event_time = 'Horário inválido.';
    }

    if (!form.event_location_name.trim()) {
      errors.event_location_name = 'Informe o nome do local.';
    }

    if (!form.event_location_address.trim()) {
      errors.event_location_address = 'Informe o endereço do evento.';
    }

    if (mapsLoaded && !addressValidation.clientAddressConfirmed) {
      errors.address_street =
        errors.address_street || 'Selecione um endereço válido nas sugestões do Google.';
    }

    if (mapsLoaded && !addressValidation.eventAddressConfirmed) {
      errors.event_location_address =
        errors.event_location_address ||
        'Selecione um endereço válido do evento nas sugestões do Google.';
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      const firstMessage = Object.values(errors)[0];
      toast.error(firstMessage);
      return false;
    }

    return true;
  }

  async function upsertContract(statusOverride = 'client_filling') {
    if (!precontract?.id) throw new Error('Pré-contrato não encontrado.');

    const assinaturaEm = new Date().toISOString();

    devLog('[TIME AUDIT]', {
      flow: 'assinatura-contrato',
      original: form.event_time,
      normalized: normalizeTimeStrict(form.event_time),
    });

    const clientForm = {
      full_name: form.full_name.trim() || null,
      marital_status: form.marital_status.trim() || null,
      profession: form.profession.trim() || null,
      cpf: cleanDigits(form.cpf) || null,
      rg: form.rg.trim() || null,
      whatsapp: cleanDigits(form.whatsapp) || null,

      address_street: form.address_street.trim() || null,
      address_number: form.address_number.trim() || null,
      address_complement: form.address_complement.trim() || null,
      address_neighborhood: form.address_neighborhood.trim() || null,
      address_cep: cleanDigits(form.address_cep) || null,
      address_city: form.address_city.trim() || null,
      address_state: form.address_state.trim() || null,

      event_date: convertDateToInput(form.event_date) || null,
      event_time: normalizeTimeStrict(form.event_time) || null,
      event_location_name: form.event_location_name.trim() || null,
      event_location_address: form.event_location_address.trim() || null,

      adjustment_request: form.adjustment_request.trim() || null,

      signer_name: form.signer_name.trim() || null,
      signer_cpf: cleanDigits(form.signer_cpf) || null,
      accepted_terms: !!form.accepted_terms,
      signed_at: statusOverride === 'signed' ? assinaturaEm : null,
    };

    const contractPayload = {
      precontract_id: precontract.id,
      event_id: precontract.event_id || null,
      workspace_id: precontract.workspace_id || null,
      public_token: precontract.public_token || token,
      status: statusOverride,
      signed_at: statusOverride === 'signed' ? assinaturaEm : null,
      signature_name:
        statusOverride === 'signed' ? form.signer_name.trim() || null : null,
      raw_payload: {
        precontract_snapshot: precontract,
        event_snapshot: {
          event_type: precontract?.event_type || null,
          event_date: clientForm?.event_date || precontract?.event_date || null,
          event_time: clientForm?.event_time || precontract?.event_time || null,
          location_name: clientForm?.event_location_name || precontract?.location_name || null,
          formation: precontract?.formation || 'Quarteto',
          instruments: precontract?.instruments || 'Voz, Violino, Piano e Cello',
        },
        client_snapshot: {
          full_name: clientForm?.full_name || precontract?.client_name || null,
          whatsapp: clientForm?.whatsapp || precontract?.client_phone || null,
          event_location_name: clientForm?.event_location_name || precontract?.location_name || null,
        },
        onboarding_fake_event: {
          event_type: precontract?.event_type || 'Casamento',
          event_date: clientForm?.event_date || precontract?.event_date || '2026-12-31',
          event_time: clientForm?.event_time || precontract?.event_time || '19:00',
          location_name: clientForm?.event_location_name || precontract?.location_name || 'Espaço Harmonics Demo',
          formation: precontract?.formation || 'Quarteto',
          instruments: precontract?.instruments || 'Voz, Violino, Piano e Cello',
        },
        client_form: clientForm,
      },
    };

    const { data: existingContract, error: existingError } = await supabase
      .from('contracts')
      .select('id')
      .eq('precontract_id', precontract.id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingContract?.id) {
      const { error } = await supabase
        .from('contracts')
        .update(contractPayload)
        .eq('id', existingContract.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('contracts')
        .insert([contractPayload]);

      if (error) throw error;
    }
  }

  async function solicitarAjuste() {
    if (!validateFormFields()) return;

    if (!form.adjustment_request.trim()) {
      toast.warning('Descreva o ajuste que deseja solicitar.');
      return;
    }

    if (!precontract?.id) {
      toast.error('Pré-contrato não encontrado.');
      return;
    }

    if (isClientContractGuideActive) {
      setGuideCorrectionExplained(true);
      setPendingAdjustmentRequest({
        id: 'guide-adjustment-request',
        precontract_id: precontract.id,
        status: 'pending',
        request_message: form.adjustment_request.trim(),
        requested_at: new Date().toISOString(),
      });
      toast.info('Simulação: a correção bloquearia a assinatura até o admin revisar. Nenhum WhatsApp real foi enviado.');
      return;
    }

    try {
      setSolicitandoAjuste(true);

      await upsertContract('client_filling');

      const contactId = await upsertContactFromSignature({
        supabase,
        precontract,
        form,
      });

      const eventId = await upsertEventFromSignature({
        supabase,
        precontract,
        contactId,
        form,
      });

      const { data: contractRow } = await supabase
        .from('contracts')
        .select('id')
        .eq('precontract_id', precontract.id)
        .maybeSingle();

      if (contractRow?.id) {
        const { error: contractLinkError } = await supabase
          .from('contracts')
          .update({
            contact_id: contactId,
            event_id: eventId,
          })
          .eq('id', contractRow.id);

        if (contractLinkError) throw contractLinkError;
      }

      const { error: precontractLinkError } = await supabase
        .from('precontracts')
        .update({
          contact_id: contactId,
          event_id: eventId,
        })
        .eq('id', precontract.id);

      if (precontractLinkError) throw precontractLinkError;

      const notesAtualizadas = [
        precontract.notes || '',
        '',
        '--- SOLICITAÇÃO DE AJUSTE DO CLIENTE ---',
        form.adjustment_request.trim(),
      ]
        .filter(Boolean)
        .join('\n');

      const { error } = await supabase
        .from('precontracts')
        .update({
          status: 'client_filling',
          client_name: form.full_name.trim() || precontract.client_name || null,
          client_email: precontract.client_email || null,
          client_phone: cleanDigits(form.whatsapp) || precontract.client_phone || null,
          event_date: convertDateToInput(form.event_date) || precontract.event_date || null,
          event_time: normalizeTimeStrict(form.event_time) || normalizeTimeStrict(precontract.event_time) || null,
          location_name: form.event_location_name.trim() || precontract.location_name || null,
          location_address:
            form.event_location_address.trim() || precontract.location_address || null,
          notes: notesAtualizadas,
        })
        .eq('id', precontract.id);

      if (error) throw error;

      const { error: cancelPreviousError } = await supabase
        .from('contract_adjustment_requests')
        .update({
          status: 'cancelled',
          resolved_note: 'Substituído por nova solicitação do cliente.',
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('precontract_id', precontract.id)
        .eq('status', 'pending');

      if (cancelPreviousError) throw cancelPreviousError;

      const { data: createdAdjustment, error: createAdjustmentError } = await supabase
        .from('contract_adjustment_requests')
        .insert([
          {
            precontract_id: precontract.id,
            contract_id: contractRow?.id || null,
            event_id: eventId || null,
            client_public_token: precontract.public_token || token,
            request_message: form.adjustment_request.trim(),
            status: 'pending',
            requested_at: new Date().toISOString(),
          },
        ])
        .select('id, precontract_id, status, request_message, requested_at')
        .single();

      if (createAdjustmentError) throw createAdjustmentError;
      setPendingAdjustmentRequest(createdAdjustment || null);

      toast.success('Seu ajuste foi enviado com sucesso.');
    } catch (error) {
      console.error('Erro ao solicitar ajuste:', error);
      toast.error(`Erro ao solicitar ajuste: ${error?.message || 'erro desconhecido'}`);
    } finally {
      setSolicitandoAjuste(false);
    }
  }

  const persistDraft = useCallback(async (formSnapshot) => {
    if (!token) return { ok: false };
    if (isClientContractGuideActive) {
      setDraftStatus('idle');
      return { ok: true, skipped: true, simulation: true };
    }
    try {
      setDraftStatus('saving');
      const result = await savePublicContractDraft(token, formSnapshot);
      if (result?.skipped) {
        setDraftStatus('saved');
        return result;
      }
      setDraftStatus('saved');
      return result;
    } catch (error) {
      setDraftStatus('error');
      throw error;
    }
  }, [isClientContractGuideActive, token]);

  useEffect(() => {
    if (!token || carregando || isClientContractGuideActive) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      persistDraft(form).catch(() => null);
    }, 1000);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [form, token, carregando, persistDraft, isClientContractGuideActive]);

  useEffect(() => {
    const onBlur = () => { persistDraft(form).catch(() => null); };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [form, persistDraft]);

 async function assinarContrato() {
   if (hasPendingAdjustment) {
      toast.info('Sua solicitação de ajuste está em análise. Assim que for concluída, a assinatura será liberada.');
      return;
    }

    if (!validateFormFields()) return;

    if (!form.signer_name.trim()) {
      toast.warning('Digite seu nome na assinatura.');
      return;
    }

    if (!form.signer_cpf.trim()) {
      toast.warning('Digite o CPF da assinatura.');
      return;
    }

    if (!isValidCpf(form.signer_cpf)) {
      toast.warning('CPF da assinatura inválido.');
      return;
    }

    if (!form.accepted_terms) {
      toast.warning('Você precisa aceitar os termos para continuar.');
      return;
    }

    if (!precontract?.id) {
      toast.error('Pré-contrato não encontrado.');
      return;
    }

    if (isClientContractGuideActive) {
      setSalvando(true);
      setSignatureStep('Simulando assinatura sem salvar dados reais...');
      setResultadoFinal({
        pdfUrl: '',
        docUrl: '',
        html: contratoHtmlResolvido,
        clientPanelUrl: `${window.location.origin}/cliente/${token}`,
        documentHash: 'simulacao-onboarding',
        missingColumns: [],
      });
      window.setTimeout(() => {
        setEnviado(true);
        setSalvando(false);
        setSignatureStep('');
        toast.success('Simulação concluída: o contrato assinado libera o fluxo operacional no app.');
        void markOnboardingFlowState({ client_contract_signed: true });
      }, 500);
      return;
    }

    try {
     await persistDraft(form).catch(() => null);
     setSalvando(true);
     setInternalPdfStatus('idle');
     setSignatureStep('Registrando assinatura...');

      console.info('[SERVER_SIGN_ATTEMPT]', { token });
      const serverSignRes = await fetch(`/api/public/contracts/${token}/sign`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form }),
      });
      const serverSignJson = await serverSignRes.json().catch(() => null);
      const hasServerPdfUrl = !!String(serverSignJson?.pdfUrl || '').trim();
      console.info('[SERVER_SIGN_RESPONSE]', {
        token,
        status: serverSignRes.status,
        responseOk: serverSignRes.ok,
        payloadOk: serverSignJson?.ok === true,
        hasPdfUrl: hasServerPdfUrl,
        fallbackAllowed: serverSignJson?.fallbackAllowed === true,
      });

      if (serverSignRes.ok && serverSignJson?.ok === true && hasServerPdfUrl) {
        console.info('[SERVER_SIGN_SUCCESS]', { token });
        const latestContract = await fetchContract();
        setContract(latestContract || null);
        setResultadoFinal({
          pdfUrl: String(serverSignJson?.pdfUrl || '').trim(),
          docUrl: serverSignJson?.docUrl || latestContract?.doc_url || '',
          html: serverSignJson?.html || contratoHtmlResolvido,
          clientPanelUrl: serverSignJson?.clientPanelUrl
            ? serverSignJson.clientPanelUrl.startsWith('http')
              ? serverSignJson.clientPanelUrl
              : `${window.location.origin}${serverSignJson.clientPanelUrl}`
            : `${window.location.origin}/cliente/${token}`,
          documentHash: serverSignJson?.documentHash || '',
          missingColumns: Array.isArray(serverSignJson?.missingColumns)
            ? serverSignJson.missingColumns
            : [],
        });
        setEnviado(true);
        return;
      }

      const serverSignMessage =
        serverSignJson?.message || 'Não foi possível concluir a assinatura agora.';
      const missingServerPdf =
        serverSignRes.ok &&
        serverSignJson?.ok === true &&
        !hasServerPdfUrl;
      if (missingServerPdf) {
        console.error('[SERVER_SIGN_MISSING_PDF]', {
          token,
          status: serverSignRes.status,
          message: serverSignMessage,
        });
      }
      console.error('[SERVER_SIGN_FAILED]', {
        token,
        status: serverSignRes.status,
        message: serverSignMessage,
        fallbackAllowed: serverSignJson?.fallbackAllowed === true,
      });

      if (
        !ENABLE_LEGACY_CONTRACT_SIGN_FALLBACK ||
        serverSignJson?.fallbackAllowed !== true
      ) {
        throw new Error(serverSignMessage);
      }

      console.warn('[LEGACY_SIGN_FALLBACK_USED]', {
        token,
        reason: serverSignMessage,
      });

// salva em estado intermediário enquanto gera o contrato final
await upsertContract('client_filling');

      const contactId = await upsertContactFromSignature({
        supabase,
        precontract,
        form,
      });

      const eventId = await upsertEventFromSignature({
        supabase,
        precontract,
        contactId,
        form,
      });

      const { data: contractRow, error: contractRowError } = await supabase
        .from('contracts')
        .select('id')
        .eq('precontract_id', precontract.id)
        .maybeSingle();

      if (contractRowError) throw contractRowError;

      if (contractRow?.id) {
        const { error: contractLinkError } = await supabase
          .from('contracts')
          .update({
            contact_id: contactId,
            event_id: eventId,
          })
          .eq('id', contractRow.id);

        if (contractLinkError) throw contractLinkError;
      }

      const { error: preError } = await supabase
        .from('precontracts')
        .update({
          contact_id: contactId,
          event_id: eventId,
        })
        .eq('id', precontract.id);

      if (preError) throw preError;
      const generateRes = await fetch('/api/contracts/generate', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          precontractId: precontract.id,
        }),
      });

const contentType = generateRes.headers.get('content-type') || '';

let generateJson = null;
let rawResponse = '';

if (contentType.includes('application/json')) {
  generateJson = await generateRes.json();
} else {
  rawResponse = await generateRes.text();
  devLog('Resposta não-JSON em /api/contracts/generate', {
    status: generateRes.status,
    rawPreview: String(rawResponse || '').slice(0, 200),
  });
  throw new Error(
    `A geração do contrato retornou uma resposta inválida. Status ${generateRes.status}.`
  );
}

if (!generateRes.ok || !generateJson?.ok) {
  const friendlyMessage =
    generateJson?.message ||
    'Não foi possível finalizar seu contrato neste momento. Por favor, entre em contato com nossa equipe.';

  console.error('[CONTRACT_PUBLIC_UI] erro técnico ao gerar contrato final', {
    status: generateRes.status,
    error: generateJson?.error || null,
    errorType: generateJson?.errorType || null,
  });

  throw new Error(friendlyMessage);
}
      setSignatureStep('Gerando documento seguro...');

      const { data: contractAtualizado, error: contractReloadError } = await supabase
        .from('contracts')
        .select('*')
        .eq('precontract_id', precontract.id)
        .maybeSingle();

      if (contractReloadError) throw contractReloadError;

      setContract(contractAtualizado || null);

      const pdfUrlFinal =
        contractAtualizado?.pdf_url ||
        generateJson?.pdfUrl ||
        '';

      const docUrlFinal =
        contractAtualizado?.doc_url ||
        generateJson?.docUrl ||
        '';

      const modoGeracao = String(
        generateJson?.mode ||
        (isInternalMode ? 'internal' : 'docs')
      ).toLowerCase();

      const htmlAssinado =
        String(generateJson?.html || '').trim() ||
        contratoHtmlResolvido;

      let internalPdfUrl = '';
      let documentHash = '';
      let missingColumns = [];
      if (modoGeracao === 'internal' && htmlAssinado) {
        setInternalPdfStatus('generating');
        setSignatureStep('Preparando PDF...');
        try {
          const internalSignRes = await fetch(`/api/contracts/public/${token}/sign`, {
            method: 'POST',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              precontractId: precontract.id,
              contractId: contractAtualizado?.id || null,
              html: htmlAssinado,
              signerName: form.signer_name,
              signerCpf: form.signer_cpf,
              origin: 'CLIENTE',
            }),
          });

          const internalSignJson = await internalSignRes.json().catch(() => null);
          if (!internalSignRes.ok || !internalSignJson?.ok) {
            console.error('[CONTRACT_PUBLIC_UI] erro técnico na assinatura interna/PDF', {
              status: internalSignRes.status,
              message: internalSignJson?.message || null,
              technicalMessage: internalSignJson?.technicalMessage || null,
            });
            throw new Error(
              internalSignJson?.message || 'Falha ao assinar contrato interno.'
            );
          }

          internalPdfUrl = String(internalSignJson?.pdfUrl || '').trim();
          documentHash = String(internalSignJson?.documentHash || '').trim();
          missingColumns = Array.isArray(internalSignJson?.missingColumns)
            ? internalSignJson.missingColumns
            : [];
          setInternalPdfStatus(internalPdfUrl ? 'ready' : 'failed');
        } catch (errorInternalPdf) {
          console.error('Erro ao gerar PDF interno:', errorInternalPdf);
          setInternalPdfStatus('failed');
        }
      }

      const resolvedPdfUrl =
        internalPdfUrl ||
        pdfUrlFinal;

      if (!resolvedPdfUrl) {
        throw new Error('Contrato gerado sem PDF final. A assinatura não será concluída até o PDF existir.');
      }

      setResultadoFinal({
        pdfUrl: resolvedPdfUrl,
        docUrl: docUrlFinal,
        html: htmlAssinado,
        clientPanelUrl: `${window.location.origin}/cliente/${token}`,
        documentHash,
        missingColumns,
      });

      if (modoGeracao === 'internal' && !htmlAssinado) {
        throw new Error('Contrato interno sem HTML final para snapshot de assinatura.');
      }

      const notesAtualizadas = [
        precontract.notes || '',
        '',
        '--- DADOS FINAIS ENVIADOS PELO CLIENTE ---',
        `Nome completo: ${form.full_name || '-'}`,
        `Estado civil: ${form.marital_status || '-'}`,
        `Profissão: ${form.profession || '-'}`,
        `CPF: ${form.cpf || '-'}`,
        `RG: ${form.rg || '-'}`,
        `WhatsApp: ${form.whatsapp || '-'}`,
        `Rua: ${form.address_street || '-'}`,
        `Número: ${form.address_number || '-'}`,
        `Complemento: ${form.address_complement || '-'}`,
        `Bairro: ${form.address_neighborhood || '-'}`,
        `CEP: ${form.address_cep || '-'}`,
        `Cidade: ${form.address_city || '-'}`,
        `Estado: ${form.address_state || '-'}`,
        `Data do evento: ${form.event_date || '-'}`,
        `Horário do evento: ${normalizeTimeStrict(form.event_time) || '-'}`,
        `Local do evento: ${form.event_location_name || '-'}`,
        `Endereço do evento: ${form.event_location_address || '-'}`,
        `Assinatura: ${form.signer_name || '-'}`,
        `CPF da assinatura: ${form.signer_cpf || '-'}`,
      ]
        .filter(Boolean)
        .join('\n');
      
      const { error: contractSignedError } = await supabase
  .from('contracts')
  .update({
    status: 'signed',
    signed_at: new Date().toISOString(),
    signature_name: form.signer_name.trim() || null,
    contact_id: contactId,
    event_id: eventId,
    ...(modoGeracao === 'internal' ? { pdf_url: resolvedPdfUrl || null } : {}),
    raw_payload: {
      ...(contractAtualizado?.raw_payload || {}),
      signed_contract_mode: modoGeracao,
      ...(htmlAssinado && modoGeracao !== 'internal'
        ? {
            signed_contract_html: htmlAssinado,
            contract_html_snapshot: htmlAssinado,
          }
        : {}),
      final_generation: {
        mode: modoGeracao,
        pdfUrl: resolvedPdfUrl || null,
        docUrl: docUrlFinal || null,
        generatedAt: new Date().toISOString(),
      },
    },
  })
  .eq('precontract_id', precontract.id);

if (contractSignedError) throw contractSignedError;

      const contractAfterSign = await fetchContract();
      setContract(contractAfterSign || null);
      const refreshedPdfUrl = contractAfterSign?.pdf_url || '';
      if (refreshedPdfUrl) {
        setResultadoFinal((prev) => ({
          ...prev,
          pdfUrl: prev.pdfUrl || refreshedPdfUrl,
        }));
      }

      const { error: precontractUpdateError } = await supabase
        .from('precontracts')
        .update({
          status: 'signed',
          client_name: form.full_name.trim() || precontract.client_name || null,
          client_email: precontract.client_email || null,
          client_phone: cleanDigits(form.whatsapp) || precontract.client_phone || null,
          event_date: convertDateToInput(form.event_date) || precontract.event_date || null,
          event_time: normalizeTimeStrict(form.event_time) || normalizeTimeStrict(precontract.event_time) || null,
          location_name: form.event_location_name.trim() || precontract.location_name || null,
          location_address:
            form.event_location_address.trim() || precontract.location_address || null,
          notes: notesAtualizadas,
        })
        .eq('id', precontract.id);

      if (precontractUpdateError) throw precontractUpdateError;
      try {
  await fetch('/api/whatsapp/send-contract-signed', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      precontractId: precontract.id,
    }),
  });
} catch (whatsError) {
  console.error('Erro ao disparar WhatsApp pós-assinatura:', whatsError);
}

      setEnviado(true);
    } catch (error) {
      console.error('Erro ao assinar contrato:', error);
      toast.error(
        error?.message || 'Não foi possível concluir a assinatura e preparar o PDF agora.'
      );
    } finally {
      setSalvando(false);
      setSignatureStep('');
    }
  }

  function preencherAssinaturaComDados() {
    setForm((prev) => ({
      ...prev,
      signer_name: prev.full_name || '',
      signer_cpf: prev.cpf || '',
    }));
  }

  if (carregando) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-6">
        <div className="mx-auto max-w-4xl">
          <Card>
            <p className="text-center text-slate-500">Carregando contrato...</p>
          </Card>
        </div>
      </main>
    );
  }

  if (!precontract) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-6">
        <div className="mx-auto max-w-4xl">
          <Card>
            <div className="py-10 text-center">
              <p className="text-xl font-bold text-slate-900">
                Link de contrato inválido
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Esse link pode ter expirado, estar incorreto ou não existir.
              </p>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  if (enviado || contratoFinalizado) {
    const pdfUrl = resultadoFinal.pdfUrl || contract?.pdf_url || '';
    const signedHtml = resultadoFinal.html || contratoHtmlResolvido || '';
    const painelUrl =
      resultadoFinal.clientPanelUrl ||
      `${window.location.origin}/cliente/${token}`;
    const internalPdfIsGenerating =
      isInternalMode && !pdfUrl && internalPdfStatus === 'generating';
    const internalPdfFailed =
      isInternalMode && !pdfUrl && internalPdfStatus === 'failed' && !!signedHtml;

    return (
      <>
      <main className="min-h-screen bg-slate-100 px-4 py-6">
        <div className="mx-auto max-w-4xl">
          <Card>
            <div className="space-y-5 py-8 text-center">
              <p className="text-sm font-semibold tracking-wide text-emerald-600">
                HARMONICS
              </p>

              <h1 className="text-3xl font-bold text-slate-900">
                Contrato assinado com sucesso
              </h1>

              <p className="mx-auto max-w-2xl text-sm text-slate-500 md:text-base">
                {isClientContractGuideActive
                  ? 'Simulação concluída: quando o cliente assina, o contrato libera o fluxo operacional no app para seguir com evento, financeiro e próximas etapas.'
                  : <>Seu contrato foi concluído com sucesso. {isInternalMode
                  ? 'Seu documento foi registrado com segurança.'
                  : 'Abaixo você já pode acessar o PDF do contrato e também o seu painel do cliente, onde poderá acompanhar informações importantes do seu evento, financeiro e as próximas etapas.'}</>}
              </p>

              {resultadoFinal.documentHash ? (
                <div className="mx-auto inline-flex rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  Documento validado com hash SHA256
                </div>
              ) : null}
              {pdfUrl ? (
                <div className="mx-auto inline-flex rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  Documento validado e disponível
                </div>
              ) : null}

              <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
  {pdfUrl ? (
    <>
      <a
        href={pdfUrl}
        target="_blank"
        rel="noreferrer"
        className={`inline-flex ${getGuideSpotlightClass(isClientContractSuccessGuideActive && successGuideVisible)}`}
        data-onboarding-tour="signed-contract-pdf"
      >
        <Button>Abrir PDF</Button>
      </a>

      <a
        href={painelUrl}
        target="_blank"
        rel="noreferrer"
        className={`inline-flex ${getGuideSpotlightClass(isClientContractSuccessGuideActive && successGuideVisible)}`}
        data-onboarding-tour="client-panel-link"
      >
        <Button variant="secondary">Abrir painel do cliente</Button>
      </a>
    </>
  ) : internalPdfIsGenerating ? (
    <>
      <Button disabled>Contrato assinado. O PDF está sendo preparado e ficará disponível em instantes.</Button>
      <a
        href={painelUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex"
      >
        <Button variant="secondary">Abrir painel do cliente</Button>
      </a>
    </>
  ) : internalPdfFailed ? (
    <>
      <Button disabled>Contrato assinado. O PDF ainda está sendo preparado.</Button>
      <a
        href={painelUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex"
      >
        <Button variant="secondary">Abrir painel do cliente</Button>
      </a>
      <p className="text-sm text-slate-500">Contrato assinado. Não foi possível preparar o PDF agora.</p>
    </>
  ) : isInternalMode && signedHtml ? (
    <>
      <p className="text-sm text-slate-500">PDF sendo preparado...</p>
      <a
        href={painelUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex"
      >
        <Button variant="secondary">Abrir painel do cliente</Button>
      </a>
    </>
  ) : (
    <>
      <p className="text-sm text-slate-500">PDF sendo preparado...</p>
      <Button variant="secondary" disabled>
        Painel liberado após PDF
      </Button>
    </>
  )}
</div>
            </div>
          </Card>
        </div>
      </main>
      {isClientContractSuccessGuideActive && successGuideVisible ? (
        <ClientContractSuccessGuide
          pdfUrl={pdfUrl}
          clientPanelUrl={`${painelUrl}${painelUrl.includes('?') ? '&' : '?'}guide=client-panel&returnTo=${encodeURIComponent('/eventos')}${eventData?.id ? `&eventId=${encodeURIComponent(eventData.id)}` : ''}`}
          onOpenPdf={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
          onOpenClientPanel={() => {
            const url = `${painelUrl}${painelUrl.includes('?') ? '&' : '?'}guide=client-panel&returnTo=${encodeURIComponent('/eventos')}${eventData?.id ? `&eventId=${encodeURIComponent(eventData.id)}` : ''}`;
            window.location.href = url;
          }}
          onClose={() => setSuccessGuideVisible(false)}
        />
      ) : null}
      {isClientContractGuideActive && guideVisible && !contratoFinalizado && !previewAberto ? (
        <ClientContractGuide
          steps={guideSteps}
          currentSpotlight={currentGuideSpotlight}
          onMarkCorrectionExplained={() => setGuideCorrectionExplained(true)}
          onFillSampleData={preencherDadosDoGuia}
          onClose={() => setGuideVisible(false)}
        />
      ) : null}
    </>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-slate-100 px-3 py-4 md:px-6 md:py-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-semibold tracking-wide text-violet-600">
                    Harmonics
                  </p>
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                    Confirmação do contrato
                  </h1>
                  <p className="text-sm text-slate-500 md:text-base">
                    Revise tudo com cuidado, confira os dados e só assine quando
                    estiver tudo correto.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge tone="purple">
                    {resumo?.status === 'signed' ? 'Assinado' : 'Em andamento'}
                  </Badge>
                  <Badge tone="default">
                    Token: {String(token).slice(0, 8)}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-5">
                <SummaryItem label="Tipo" value={resumo?.eventType} />
                <SummaryItem label="Data" value={formatDateBR(resumo?.eventDate)} />
                <SummaryItem
                  label="Hora"
                  value={
                    resumo?.eventTime
                      ? normalizeTimeStrict(resumo.eventTime)
                      : '--:--'
                  }
                />
                <SummaryItem label="Formação" value={resumo?.formation} />
                <SummaryItem label="Instrumentos" value={resumo?.instruments} />
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <Card title="Dados já combinados">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <SummaryItem label="Cliente de referência" value={resumo?.clientName} />
                  <SummaryItem label="Endereço do evento" value={resumo?.locationAddress} />
                  <SummaryItem
                    label="Receptivo"
                    value={resumo?.receptionHours ? 'Sim' : 'Não'}
                  />
                  {Number(resumo?.receptionHours || 0) > 0 ? (
                    <SummaryItem
                      label="Receptivo (formação/instrumentos)"
                      value={
                        [resumo?.receptionFormation, resumo?.receptionInstruments]
                          .filter(Boolean)
                          .join(' - ') || '-'
                      }
                    />
                  ) : null}
                  <SummaryItem label="Som" value={resumo?.hasSound ? 'Sim' : 'Não'} />
                  <SummaryItem
                    label="Transporte"
                    value={resumo?.hasTransport ? 'Sim' : 'Não'}
                  />
                </div>
              </Card>

              <Card className={getGuideSpotlightClass(currentGuideSpotlight === 'clientData')}>
  <SectionTitle subtitle="Preencha os dados do contratante exatamente como deseja que constem no contrato.">
    Dados do contratante
  </SectionTitle>

  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div>
      <Input
        label="Nome completo"
        value={form.full_name}
        onChange={(e) => handleChange('full_name', e.target.value)}
        className={getInputTone(fieldErrors.full_name)}
      />
      <FieldFeedback error={fieldErrors.full_name} />
    </div>

    <div>
      <Input
        label="Estado civil"
        value={form.marital_status}
        onChange={(e) => handleChange('marital_status', e.target.value)}
        className={getInputTone(fieldErrors.marital_status)}
      />
      <FieldFeedback error={fieldErrors.marital_status} />
    </div>

    <div>
      <Input
        label="Profissão"
        value={form.profession}
        onChange={(e) => handleChange('profession', e.target.value)}
        className={getInputTone(fieldErrors.profession)}
      />
      <FieldFeedback error={fieldErrors.profession} />
    </div>

    <div>
      <Input
        label="CPF"
        value={form.cpf}
        onChange={(e) => handleChange('cpf', e.target.value)}
        placeholder="000.000.000-00"
        inputMode="numeric"
        className={getInputTone(fieldErrors.cpf)}
      />
      <FieldFeedback error={fieldErrors.cpf} />
    </div>

    <div>
      <Input
        label="RG"
        value={form.rg}
        onChange={(e) => handleChange('rg', e.target.value)}
        className={getInputTone(fieldErrors.rg)}
      />
      <FieldFeedback error={fieldErrors.rg} />
    </div>

    <div>
      <Input
        label="WhatsApp"
        value={form.whatsapp}
        onChange={(e) => handleChange('whatsapp', e.target.value)}
        placeholder="(71) 99999-9999"
        inputMode="numeric"
        className={getInputTone(fieldErrors.whatsapp)}
      />
      <FieldFeedback error={fieldErrors.whatsapp} />
    </div>
  </div>
</Card>

<Card className={getGuideSpotlightClass(currentGuideSpotlight === 'clientData')}>
  <SectionTitle subtitle="Comece digitando e selecione um endereço válido do Google.">
    Endereço do contratante
  </SectionTitle>

  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div className="relative">
      <Input
        ref={addressStreetRef}
        label="Endereço completo"
        value={form.address_street}
        onChange={(e) => handleChange('address_street', e.target.value)}
        placeholder="Digite e selecione nas sugestões"
        autoComplete="street-address"
        className={`
          ${getInputTone(fieldErrors.address_street)}
          ${clientAddressStatus === 'typing' ? 'border-violet-400 ring-2 ring-violet-100' : ''}
          ${clientAddressStatus === 'selected' ? 'border-emerald-400 bg-emerald-50/30' : ''}
        `}
      />

      {clientAddressStatus === 'typing' && (
        <div className="absolute right-3 top-9 text-violet-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      )}

      {clientAddressStatus === 'selected' && (
        <div className="absolute right-3 top-9 text-emerald-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      )}

      <FieldFeedback error={fieldErrors.address_street} />

      {clientAddressStatus === 'typing' && !fieldErrors.address_street && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-violet-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Selecione uma sugestão do Google
        </p>
      )}

      {clientAddressStatus === 'selected' && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Endereço confirmado
        </div>
      )}

      {clientAddressStatus === 'fallback' && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-semibold">⚠️ Busca automática indisponível</p>
          <p className="mt-1 text-amber-700">Você pode preencher manualmente.</p>
        </div>
      )}
    </div>

    <div>
      <Input
        label="Número"
        value={form.address_number}
        onChange={(e) => handleChange('address_number', e.target.value)}
      />
    </div>

    <div>
      <Input
        label="Complemento"
        value={form.address_complement}
        onChange={(e) => handleChange('address_complement', e.target.value)}
      />
    </div>

    <div>
      <Input
        label="Bairro"
        value={form.address_neighborhood}
        onChange={(e) => handleChange('address_neighborhood', e.target.value)}
        className={getInputTone(fieldErrors.address_neighborhood)}
      />
      <FieldFeedback error={fieldErrors.address_neighborhood} />
    </div>

    <div>
      <Input
        label="CEP"
        value={form.address_cep}
        onChange={(e) => handleChange('address_cep', e.target.value)}
        placeholder="00000-000"
        inputMode="numeric"
        autoComplete="postal-code"
        className={getInputTone(fieldErrors.address_cep)}
      />
      <FieldFeedback error={fieldErrors.address_cep} />
    </div>

    <div>
      <Input
        label="Cidade"
        value={form.address_city}
        onChange={(e) => handleChange('address_city', e.target.value)}
        className={getInputTone(fieldErrors.address_city)}
      />
      <FieldFeedback error={fieldErrors.address_city} />
    </div>

    <div>
      <Input
        label="Estado"
        value={form.address_state}
        onChange={(e) => handleChange('address_state', e.target.value)}
        placeholder="UF"
        className={getInputTone(fieldErrors.address_state)}
      />
      <FieldFeedback error={fieldErrors.address_state} />
    </div>
  </div>
</Card>

<Card className={getGuideSpotlightClass(currentGuideSpotlight === 'clientData')}>
  <SectionTitle subtitle="Confirme com atenção os dados do evento.">
    Dados do evento
  </SectionTitle>

  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div>
      <Input
        label="Data do evento"
        value={form.event_date}
        onChange={(e) => handleChange('event_date', e.target.value)}
        placeholder="dd/mm/aaaa"
        inputMode="numeric"
        className={getInputTone(fieldErrors.event_date)}
      />
      <FieldFeedback error={fieldErrors.event_date} />
    </div>

    <div>
      <Input
        label="Horário do evento"
        type="time"
        step="60"
        value={normalizeTimeStrict(form.event_time)}
        onChange={(e) => handleChange('event_time', e.target.value)}
        className={getInputTone(fieldErrors.event_time)}
      />
      <FieldFeedback error={fieldErrors.event_time} />
    </div>

    <div>
      <Input
        label="Nome do local"
        value={form.event_location_name}
        onChange={(e) =>
          handleChange('event_location_name', e.target.value)
        }
        className={getInputTone(fieldErrors.event_location_name)}
      />
      <FieldFeedback error={fieldErrors.event_location_name} />
    </div>

    <div className="relative">
      <Input
        ref={eventAddressRef}
        label="Endereço do evento"
        value={form.event_location_address}
        onChange={(e) =>
          handleChange('event_location_address', e.target.value)
        }
        placeholder="Digite e selecione nas sugestões"
        autoComplete="street-address"
        className={`
          ${getInputTone(fieldErrors.event_location_address)}
          ${eventAddressStatus === 'typing' ? 'border-violet-400 ring-2 ring-violet-100' : ''}
          ${eventAddressStatus === 'selected' ? 'border-emerald-400 bg-emerald-50/30' : ''}
        `}
      />

      {eventAddressStatus === 'typing' && (
        <div className="absolute right-3 top-9 text-violet-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      )}

      {eventAddressStatus === 'selected' && (
        <div className="absolute right-3 top-9 text-emerald-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      )}

      <FieldFeedback error={fieldErrors.event_location_address} />

      {eventAddressStatus === 'typing' && !fieldErrors.event_location_address && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-violet-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Digite e selecione uma opção abaixo
        </p>
      )}

      {eventAddressStatus === 'selected' && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Endereço validado com sucesso
        </div>
      )}

      {eventAddressStatus === 'fallback' && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-semibold">⚠️ Busca automática indisponível</p>
          <p className="mt-1 text-amber-700">Você pode digitar manualmente.</p>
        </div>
      )}
    </div>
  </div>
</Card>

              <Card className={getGuideSpotlightClass(currentGuideSpotlight === 'correction')}>
                <SectionTitle subtitle="Caso precise corrigir alguma informação antes da assinatura, descreva abaixo.">
                  Solicitar correção
                </SectionTitle>

      {pendingAdjustmentRequest?.id &&
 String(pendingAdjustmentRequest?.status || '').toLowerCase() === 'resolved' ? (
  <div className="mb-4">
    <AlertCard tone="default" title="Pedido corrigido!">
      Seu último pedido de ajuste foi revisado e a assinatura já foi liberada novamente.
      Caso ainda queira alterar algo, você pode enviar uma nova solicitação abaixo.
    </AlertCard>
  </div>
) : null}

                <textarea
                  value={form.adjustment_request}
                  onChange={(e) =>
                    handleChange('adjustment_request', e.target.value)
                  }
                  className="min-h-[110px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                  placeholder="Descreva aqui a correção que deseja solicitar..."
                />

                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    onClick={solicitarAjuste}
                    disabled={solicitandoAjuste}
                  >
                    {solicitandoAjuste ? 'Enviando correção...' : 'Solicitar correção'}
                  </Button>

                  <Button
                    variant="soft"
                    onClick={() => handleChange('adjustment_request', '')}
                  >
                    Limpar texto
                  </Button>
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card title="Valor acordado">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                    Total
                  </p>
                  <p className="mt-1 text-3xl font-bold text-emerald-700">
                    {formatMoney(resumo?.agreedAmount)}
                  </p>
                </div>
              </Card>

              <Card title="Leitura do contrato" className={getGuideSpotlightClass(currentGuideSpotlight === 'contractViewer')}>
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Leia o contrato completo antes da assinatura.
                  </p>
                  <p className="text-xs font-medium text-slate-500">
                    Status: {contractViewedAt ? `visualizado em ${formatDateTimeBR(contractViewedAt)}` : (previewAberto ? 'em leitura' : 'ainda não visualizado')}
                  </p>
                  <Button variant="secondary" onClick={abrirPreviewContrato}>
                    Visualizar contrato
                  </Button>

                  {previewError ? (
                    <p className="text-sm text-red-600">{previewError}</p>
                  ) : null}
                </div>
              </Card>

              <Card title="Assinatura eletrônica" className={getGuideSpotlightClass(currentGuideSpotlight === 'signature' || currentGuideSpotlight === 'signButton')}>
                <div className="space-y-4">
                  {hasPendingAdjustment ? (
                    <AlertCard tone="amber" title="Assinatura bloqueada temporariamente">
                      Sua solicitação de ajuste está em análise. Assim que for concluída, a assinatura será liberada.
                    </AlertCard>
                  ) : null}

                  <Input
                    label="Nome na assinatura"
                    value={form.signer_name}
                    onChange={(e) => handleChange('signer_name', e.target.value)}
                  />

                  <Input
                    label="CPF da assinatura"
                    value={form.signer_cpf}
                    onChange={(e) => handleChange('signer_cpf', e.target.value)}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                  />

                  <Button variant="soft" onClick={preencherAssinaturaComDados}>
                    Usar dados acima
                  </Button>

                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
                    <input
                      type="checkbox"
                      checked={form.accepted_terms}
                      onChange={(e) =>
                        handleChange('accepted_terms', e.target.checked)
                      }
                      className="mt-1 h-5 w-5"
                    />
                    <span className="text-sm text-slate-700">
                      Declaro que li atentamente, conferi os dados e concordo com
                      os termos para continuidade e formalização do contrato.
                    </span>
                  </label>

                  {salvando && signatureStep ? (
                    <p className="text-sm font-medium text-violet-700">{signatureStep}</p>
                  ) : null}

                  {draftStatus === 'saving' ? <p className="text-xs text-slate-500">Salvando…</p> : null}
                  {draftStatus === 'saved' ? <p className="text-xs text-emerald-600">Dados salvos</p> : null}
                  {draftStatus === 'error' ? <p className="text-xs text-amber-600">Falha ao salvar, tentando novamente</p> : null}

                  <span className={getGuideSpotlightClass(currentGuideSpotlight === 'signButton')}>
                    <Button onClick={assinarContrato} disabled={!canSubmitSignature}>
                      {salvando ? 'Assinando...' : 'Assinar contrato'}
                    </Button>
                  </span>
                </div>
              </Card>

              <Card title="Importante">
                <p className="text-sm text-slate-600">
                  Leia tudo com atenção e confira os dados com cuidado.
                  Informe sempre corretamente o horário de início da cerimônia ou
                  evento. Há cláusulas específicas sobre atraso no contrato final.
                </p>
              </Card>
            </div>
          </div>
        </div>

        {isClientContractGuideActive && guideVisible && !previewAberto ? (
          <ClientContractGuide
            steps={guideSteps}
            currentSpotlight={currentGuideSpotlight}
            onMarkCorrectionExplained={() => setGuideCorrectionExplained(true)}
            onFillSampleData={preencherDadosDoGuia}
            onClose={() => setGuideVisible(false)}
          />
        ) : null}

        {previewAberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/60 p-3">
            <div className="relative flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Prévia do contrato</p>
                  <p className="text-xs text-slate-500">
                    Confira o documento com atenção antes de assinar.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setPreviewAberto(false);
                    setPreviewLoading(false);
                    setPreviewError('');
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>

              <div className="relative flex-1 overflow-hidden bg-slate-100 p-4 md:p-6">
                {isInternalMode ? (
                  <div className="h-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-inner md:p-10">
                    <article
                      className="prose prose-slate max-w-none"
                      dangerouslySetInnerHTML={{ __html: contratoHtmlResolvido }}
                    />
                  </div>
                ) : (
                  <>
                    {previewLoading && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                        <p className="text-sm text-slate-600">Gerando prévia do contrato...</p>
                      </div>
                    )}

                    <iframe
                      src={`/api/contracts/preview-html/${token}`}
                      title="Prévia do contrato"
                      className="h-full w-full rounded-2xl border border-slate-200 bg-white"
                      onLoad={() => setPreviewLoading(false)}
                    />
                  </>
                )}

                <div className="h-full max-h-[80vh] overflow-y-auto p-4 md:p-6" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
                  <div className="mx-auto w-full max-w-[880px] rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_20px_40px_rgba(15,23,42,0.08)] md:p-10">
                    {previewHtml ? (
                      <article
                        className="prose prose-slate max-w-none text-[15px] leading-7 [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-black [&_h2]:mt-7 [&_h2]:text-xl [&_h2]:font-extrabold [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold [&_p]:my-3 [&_strong]:font-bold"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    ) : (
                      <p className="text-sm text-slate-500">
                        {previewLoading ? 'Carregando contrato...' : 'Nenhum conteúdo disponível para visualização.'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
