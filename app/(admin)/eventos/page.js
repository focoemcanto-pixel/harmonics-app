'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { generatePrecontractFromEvent } from '@/lib/contracts/generate-precontract-from-event';
import AdminShell from '@/components/admin/AdminShell';
import AdminPageHero from '@/components/admin/AdminPageHero';
import AdminSummaryCard from '@/components/admin/AdminSummaryCard';
import AdminSectionTitle from '@/components/admin/AdminSectionTitle';
import AdminSegmentTabs from '@/components/admin/AdminSegmentTabs';
import AdminEventCard from '@/components/admin/AdminEventCard';
import { Field, Input, Select } from '@/components/admin/AdminFormPrimitives';
import Pill from '@/components/admin/AdminPill';
import AppModal from '@/components/ui/AppModal';
import { useAppToast } from '@/components/ui/ToastProvider';
import EventosOperacaoTab from '@/components/eventos/EventosOperacaoTab';
import EventosResumoTab from '@/components/eventos/EventosResumoTab';
import EventosPricingTab from '@/components/eventos/EventosPricingTab';
import EventosFormularioTab from '@/components/eventos/EventosFormularioTab';
import {
  isContratoPendente,
  isFinanceiroPendente,
  isRascunho,
  getOperacaoAlert,
  getQuickActions,
  getOperacaoPrimaryAction,
} from '@/lib/eventos/eventos-operacao';
import {
  toNumber,
  formatMoney,
  cleanPhone,
  formatPhoneDisplay,
  formatDateBR,
  getMonthKey,
  formatMonthYearLabel,
} from '@/lib/eventos/eventos-format';
import { normalizeTimeStrict, isValidTime, sanitizeTimeFields } from '@/lib/time/normalize-time';

import {
  normalizeFormation,
  getDefaultPricing,
  buildCanonicalFormationPrices,
  hydratePricingFromCanonical,
  getAutomaticFormationPrice,
  getAutomaticReceptionPrice,
  getPaymentStatus,
  getPaymentTone,
  getAutomaticCosts,
  buildCostBreakdown,
  sanitizeCustomCosts,
} from '@/lib/eventos/eventos-finance';
import {
  isPastEvent,
  isTodayEvent,
  isUpcomingEvent,
  getTimelineLabel,
  getOperationalTone,
  getToneClasses,
  getPriorityBannerClasses,
} from '@/lib/eventos/eventos-ui';

const EVENT_TYPES = [
  'Casamento',
  'Aniversário',
  'Corporativo',
  'Igreja',
  'Outro',
];

const FORMATIONS = [
  'Solo',
  'Duo',
  'Trio',
  'Quarteto',
  'Quinteto',
  'Sexteto',
  'Septeto',
];

const VIEW_MODES = ['Mês atual', 'Todos', 'Realizados'];
const SORT_MODES = ['Data do evento', 'Data de adição'];
const DESKTOP_TABS = [
  { key: 'visao', label: 'Visão geral' },
  { key: 'operacao', label: 'Operação' },
  { key: 'evento', label: 'Novo / Editar' },
  { key: 'precos', label: 'Preços' },
];
const ADMIN_LIST_LIMIT = 100;
const EVENTS_SELECT_FIELDS =
  'id, created_at, client_name, event_type, event_date, event_time, duration_min, location_name, formation, instruments, has_sound, has_transport, reception_hours, whatsapp_name, whatsapp_phone, agreed_amount, paid_amount, open_amount, payment_status, status, has_antesala, antesala_enabled, antesala_requested_by_client, antesala_request_status, antesala_duration_minutes, antesala_price_increment, musician_cost, sound_cost, extra_transport_cost, other_cost, profit_amount, transport_price, cost_breakdown, costs_source';
const PRECONTRACTS_SELECT_FIELDS =
  'id, created_at, event_id, client_name, event_date, event_time, status, public_token';
const CONTRACTS_SELECT_FIELDS =
  'id, created_at, precontract_id, event_id, status, signed_at, pdf_url, doc_url, public_token';
const PRICING_SELECT_FIELDS = '*';
const EVENTOS_CACHE_TTL_MS = 60 * 1000;
const EVENTOS_LIST_TITLE = 'Eventos';
const EVENTOS_LIST_SUBTITLE = 'Pesquise, filtre e acompanhe sua operação.';
const VIEW_MODE_BY_QUERY = {
  mes: 'Mês atual',
  todos: 'Todos',
  realizados: 'Realizados',
};
const VIEW_MODE_TO_QUERY = {
  'Mês atual': 'mes',
  Todos: 'todos',
  Realizados: 'realizados',
};
const SORT_MODE_BY_QUERY = {
  data_evento: 'Data do evento',
  data_adicao: 'Data de adição',
};
const SORT_MODE_TO_QUERY = {
  'Data do evento': 'data_evento',
  'Data de adição': 'data_adicao',
};
const PRICING_FIELDS_TO_CONFIRM = [
  'price_solo',
  'price_duo',
  'price_trio',
  'price_quarteto',
  'price_quinteto',
  'price_sexteto',
  'price_septeto',
  'sound_price',
  'reception_duo_1h',
  'reception_duo_2h',
  'reception_duo_3h',
  'reception_trio_1h',
  'reception_trio_2h',
  'reception_trio_3h',
  'reception_quarteto_1h',
  'reception_quarteto_2h',
  'reception_quarteto_3h',
  'reception_quinteto_1h',
  'reception_quinteto_2h',
  'reception_quinteto_3h',
  'reception_sexteto_1h',
  'reception_sexteto_2h',
  'reception_sexteto_3h',
  'reception_septeto_1h',
  'reception_septeto_2h',
  'reception_septeto_3h',
];
const COST_FIELDS_TO_CONFIRM = [
  'musician_unit_cost',
  'sound_default_cost',
  'transport_default_cost',
  'other_default_cost',
];
let eventosAdminCache = {
  updatedAt: 0,
  eventos: [],
  scaleSummaryByEventId: new Map(),
  precontracts: [],
  contracts: [],
  contatos: [],
  pricingId: null,
  pricing: null,
};

function logLoadError(scope, error) {
  console.error(`Erro ao carregar ${scope}:`, {
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    code: error?.code,
    full: error,
  });
}

function buildScaleSummaryByEvent(eventMusicians = []) {
  const summaryMap = new Map();

  eventMusicians.forEach((item) => {
    const eventId = String(item?.event_id || '');
    if (!eventId) return;

    const current = summaryMap.get(eventId) || {
      totalMusicians: 0,
      confirmedMusicians: 0,
    };
    const status = String(item?.status || '').trim().toLowerCase();

    current.totalMusicians += 1;
    if (status === 'confirmed' || status === 'confirmado') {
      current.confirmedMusicians += 1;
    }

    summaryMap.set(eventId, current);
  });

  return summaryMap;
}

function getContractStatus(ev, contractsByEventId) {
  const contract = contractsByEventId.get(String(ev.id));

  if (!contract) {
    return {
      label: 'Sem contrato',
      tone: 'slate',
      action: 'create',
    };
  }

  if (contract.label === 'Contrato assinado') {
    return {
      label: 'Assinado',
      tone: 'emerald',
      action: 'view',
    };
  }

  return {
    label: 'Pendente',
    tone: 'violet',
    action: 'edit',
  };
}

function getInitialForm() {
  return {
    client_contact_id: '',
    client_name: '',
    event_type: '',
    event_date: '',
    event_time: '',
    duration_min: '60',
    location_name: '',
    formation: '',
    instruments: '',
    observations: '',
    guests_emails: '',
    whatsapp_name: '',
    whatsapp_phone: '',
    has_sound: false,
    reception_hours: '0',

    formation_price: '',
    sound_price: '',
    reception_price: '',
    transport_price: '',

    paid_amount: '',

    musician_cost: '',
    sound_cost: '',
    extra_transport_cost: '',
    other_cost: '',

    status: 'Rascunho',
  };
}
function FeedbackBanner({ feedback, onClose }) {
  if (!feedback) return null;

  const tones = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
  };

  return (
    <div
      className={`rounded-[22px] border px-4 py-4 shadow-[0_8px_20px_rgba(17,24,39,0.04)] ${tones[feedback.type] || tones.info}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[12px] font-black uppercase tracking-[0.08em] opacity-80">
            {feedback.title || 'Atualização'}
          </div>
          <div className="mt-2 text-[14px] font-semibold leading-6">
            {feedback.message}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-[14px] bg-white/80 px-3 py-2 text-[12px] font-black text-[#0f172a]"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

function DeleteEventDialog({
  open,
  eventName,
  loading = false,
  onCancel,
  onConfirm,
}) {
  return (
    <AppModal
      open={open}
      onClose={onCancel}
      title="Excluir este evento?"
      subtitle="Essa ação é definitiva e bloqueada quando houver vínculos operacionais."
      maxWidthClass="max-w-lg"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-[14px] border border-[#dbe3ef] bg-white px-4 py-2 text-[13px] font-black text-[#0f172a]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-[14px] bg-red-600 px-4 py-2 text-[13px] font-black text-white"
          >
            {loading ? 'Excluindo...' : 'Excluir evento'}
          </button>
        </div>
      }
    >
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#ef4444]">
          Confirmar exclusão
        </p>
        <p className="mt-2 text-[14px] text-[#475569]">
          {eventName
            ? `Você está prestes a excluir “${eventName}”.`
            : 'Você está prestes a excluir este evento.'}{' '}
          Revise antes de confirmar.
        </p>
    </AppModal>
  );
}

function BulkDeleteDialog({
  open,
  quantity,
  loading = false,
  onCancel,
  onConfirm,
}) {
  return (
    <AppModal
      open={open}
      onClose={onCancel}
      title={`Excluir ${quantity} evento(s) selecionado(s)?`}
      subtitle="Esta ação remove eventos e todos os vínculos operacionais."
      maxWidthClass="max-w-xl"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-[14px] border border-[#dbe3ef] bg-white px-4 py-2 text-[13px] font-black text-[#0f172a]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-[14px] bg-red-600 px-4 py-2 text-[13px] font-black text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Excluindo eventos...' : 'Confirmar exclusão em massa'}
          </button>
        </div>
      }
    >
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#ef4444]">
          Exclusão em massa
        </p>
        <p className="mt-2 text-[14px] text-[#475569]">
          Esta ação remove os eventos e seus vínculos operacionais (contratos, pré-contratos,
          pagamentos, convites, escala e repertório). É uma ação definitiva.
        </p>
    </AppModal>
  );
}

export default function EventosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useAppToast();
  const [eventos, setEventos] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [contatos, setContatos] = useState([]);
  const [precontracts, setPrecontracts] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [operacaoFiltro, setOperacaoFiltro] = useState('todos');
  const [pagamentoAbertoId, setPagamentoAbertoId] = useState(null);
  const [valorPagamento, setValorPagamento] = useState('');
  const [salvandoPagamentoId, setSalvandoPagamentoId] = useState(null);
  const [ultimoPagamentoAtualizadoId, setUltimoPagamentoAtualizadoId] = useState(null);
  const [contratoAbertoId, setContratoAbertoId] = useState(null);
  const [gerandoContratoId, setGerandoContratoId] = useState(null);
  const [excluindoEventoId, setExcluindoEventoId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [selectedEventIds, setSelectedEventIds] = useState([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    eventId: null,
    eventName: '',
  });

  const [viewMode, setViewMode] = useState('Mês atual');
  const [monthFilter, setMonthFilter] = useState('all');
  const [sortMode, setSortMode] = useState('Data do evento');
  const [busca, setBusca] = useState('');
  const [debouncedBusca, setDebouncedBusca] = useState('');

  const [showPricing, setShowPricing] = useState(false);
  const [scaleSummaryByEventId, setScaleSummaryByEventId] = useState(new Map());
  const [, setPricingId] = useState(null);
  const [pricing, setPricing] = useState(getDefaultPricing());
  const [financeCostDefaults, setFinanceCostDefaults] = useState({
    musician_unit_cost: 0,
    sound_default_cost: 0,
    transport_default_cost: 0,
    other_default_cost: 0,
    custom_costs: [],
    notes: '',
  });

  const [form, setForm] = useState(getInitialForm());
  const [mobileTab, setMobileTab] = useState('resumo');
  const [desktopTab, setDesktopTab] = useState('visao');
  const safeMobileTab = ['resumo', 'evento', 'lista', 'precos'].includes(mobileTab)
    ? mobileTab
    : 'lista';
  const currentParamsValue = searchParams.toString();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedBusca(busca.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [busca]);

  useEffect(() => {
    const params = new URLSearchParams(currentParamsValue);
    const queryViewMode = VIEW_MODE_BY_QUERY[params.get('status')];
    const queryMonth = params.get('data');
    const queryBusca = params.get('busca');
    const querySortMode = SORT_MODE_BY_QUERY[params.get('ordem')];
    const requestedTab = params.get('tab');
    const normalizedTab =
      requestedTab === 'escala' || requestedTab === 'operacao'
        ? 'operacao'
        : requestedTab || 'visao';

    setViewMode((current) => {
      const resolvedViewMode =
        queryMonth && queryMonth !== 'all'
          ? 'Todos'
          : queryViewMode || current;
      return resolvedViewMode !== current ? resolvedViewMode : current;
    });
    setSortMode((current) =>
      querySortMode && querySortMode !== current ? querySortMode : current
    );
    if (normalizedTab === 'operacao') {
      setDesktopTab((current) => (current !== 'operacao' ? 'operacao' : current));
      setMobileTab((current) => (current !== 'lista' ? 'lista' : current));
    }

    setMonthFilter((current) => {
      const next = queryMonth || 'all';
      return next !== current ? next : current;
    });
    setBusca((current) => {
      const next = queryBusca || '';
      return next !== current ? next : current;
    });
  }, [currentParamsValue]);

  useEffect(() => {
    const nextParams = new URLSearchParams(currentParamsValue);
    const statusQuery = VIEW_MODE_TO_QUERY[viewMode];
    const sortQuery = SORT_MODE_TO_QUERY[sortMode];
    const requestedTab = nextParams.get('tab');
    const shouldUseOperacaoTab =
      requestedTab === 'escala' ||
      requestedTab === 'operacao' ||
      desktopTab === 'operacao';

    if (statusQuery) nextParams.set('status', statusQuery);
    if (sortQuery) nextParams.set('ordem', sortQuery);
    if (monthFilter && monthFilter !== 'all') nextParams.set('data', monthFilter);
    else nextParams.delete('data');
    if (debouncedBusca) nextParams.set('busca', debouncedBusca);
    else nextParams.delete('busca');
    if (shouldUseOperacaoTab) {
      nextParams.set('tab', 'operacao');
    } else if (desktopTab && desktopTab !== 'visao') {
      nextParams.set('tab', desktopTab);
    } else {
      nextParams.delete('tab');
    }

    const nextValue = nextParams.toString();
    const currentValue = currentParamsValue;
    if (nextValue !== currentValue) {
      router.replace(nextValue ? `/eventos?${nextValue}` : '/eventos', { scroll: false });
    }
  }, [viewMode, sortMode, monthFilter, debouncedBusca, router, desktopTab, currentParamsValue]);

  useEffect(() => {
    console.info('[EVENTOS][TITLE_SOURCE]', {
      source: 'EVENTOS_LIST_TITLE constant',
      title: EVENTOS_LIST_TITLE,
      subtitle: EVENTOS_LIST_SUBTITLE,
    });
  }, []);

  async function carregarEventos() {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(EVENTS_SELECT_FIELDS)
        .order('created_at', { ascending: false })
        .limit(ADMIN_LIST_LIMIT);

      if (error) throw error;
      const sanitized = (data || []).map((item) => sanitizeTimeFields(item));
      const eventIds = sanitized
        .map((item) => String(item?.id || '').trim())
        .filter(Boolean);
      let scaleSummaryMap = new Map();

      if (eventIds.length > 0) {
        const { data: eventMusiciansData, error: eventMusiciansError } = await supabase
          .from('event_musicians')
          .select('event_id, status')
          .in('event_id', eventIds);

        if (eventMusiciansError) throw eventMusiciansError;
        scaleSummaryMap = buildScaleSummaryByEvent(eventMusiciansData || []);
      }

      setScaleSummaryByEventId(scaleSummaryMap);
      setEventos(sanitized);
      eventosAdminCache.eventos = sanitized;
      eventosAdminCache.scaleSummaryByEventId = scaleSummaryMap;
      eventosAdminCache.updatedAt = Date.now();
    } catch (error) {
      logLoadError('eventos', error);
      toast.error('Erro ao carregar eventos. Tente novamente mais tarde.');
    }
  }

  async function salvarPagamento(ev, tipo = 'total') {
    const valor = Number(valorPagamento || 0);

    if (!valor && tipo === 'parcial') {
      toast.warning('Informe um valor');
      return;
    }

    setSalvandoPagamentoId(ev.id);

    let novoPago =
      tipo === 'total'
        ? Number(ev.agreed_amount || 0)
        : Number(ev.paid_amount || 0) + valor;

    let status = 'Pago';

    if (novoPago < Number(ev.agreed_amount || 0)) {
      status = 'Parcial';
    }

    const { error } = await supabase
      .from('events')
      .update({
        paid_amount: novoPago,
        payment_status: status,
        open_amount: Math.max(0, Number(ev.agreed_amount || 0) - novoPago),
      })
      .eq('id', ev.id);

    if (error) {
      setSalvandoPagamentoId(null);
      toast.error('Erro ao salvar pagamento');
      return;
    }

    setEventos((prev) =>
      prev.map((item) =>
        item.id === ev.id
          ? {
              ...item,
              paid_amount: novoPago,
              payment_status: status,
              open_amount: Math.max(0, Number(item.agreed_amount || 0) - novoPago),
            }
          : item
      )
    );

    setPagamentoAbertoId(null);
    setValorPagamento('');
    setSalvandoPagamentoId(null);
    setUltimoPagamentoAtualizadoId(ev.id);

    setTimeout(() => {
      setUltimoPagamentoAtualizadoId((current) =>
        current === ev.id ? null : current
      );
    }, 2200);
  }

  async function carregarPricing() {
    try {
      const { data, error } = await supabase
        .from('pricing_settings')
        .select(PRICING_SELECT_FIELDS)
        .eq('slug', 'default')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const normalizedPricing = hydratePricingFromCanonical(data);
        setPricingId(data.id);
        setPricing((prev) => ({
          ...prev,
          ...normalizedPricing,
        }));
        eventosAdminCache.pricingId = data.id;
        eventosAdminCache.pricing = normalizedPricing;
        eventosAdminCache.updatedAt = Date.now();
      }
    } catch (error) {
      logLoadError('pricing', error);
    }
  }

  async function carregarFinanceCostDefaults() {
    try {
      const { data, error } = await supabase
        .from('finance_cost_defaults')
        .select(
          'slug, musician_unit_cost, sound_default_cost, transport_default_cost, other_default_cost, custom_costs, notes'
        )
        .eq('slug', 'default')
        .maybeSingle();

      if (error) throw error;
      if (!data) return;

      const normalizedCostDefaults = {
        musician_unit_cost: toNumber(data.musician_unit_cost),
        sound_default_cost: toNumber(data.sound_default_cost),
        transport_default_cost: toNumber(data.transport_default_cost),
        other_default_cost: toNumber(data.other_default_cost),
        custom_costs: sanitizeCustomCosts(data.custom_costs),
        notes: String(data.notes || ''),
      };

      setFinanceCostDefaults(normalizedCostDefaults);
      setPricing((prev) => ({
        ...prev,
        musician_unit_cost: normalizedCostDefaults.musician_unit_cost,
        sound_default_cost: normalizedCostDefaults.sound_default_cost,
        transport_default_cost: normalizedCostDefaults.transport_default_cost,
        other_default_cost: normalizedCostDefaults.other_default_cost,
        custom_costs: normalizedCostDefaults.custom_costs,
        finance_notes: normalizedCostDefaults.notes,
      }));
      eventosAdminCache.pricing = {
        ...(eventosAdminCache.pricing || {}),
        musician_unit_cost: normalizedCostDefaults.musician_unit_cost,
        sound_default_cost: normalizedCostDefaults.sound_default_cost,
        transport_default_cost: normalizedCostDefaults.transport_default_cost,
        other_default_cost: normalizedCostDefaults.other_default_cost,
        custom_costs: normalizedCostDefaults.custom_costs,
        finance_notes: normalizedCostDefaults.notes,
      };
      eventosAdminCache.updatedAt = Date.now();
    } catch (error) {
      logLoadError('finance_cost_defaults', error);
    }
  }

  async function carregarContatos() {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, email, phone')
        .order('name', { ascending: true });

      if (error) throw error;

      setContatos(data || []);
      eventosAdminCache.contatos = data || [];
      eventosAdminCache.updatedAt = Date.now();
    } catch (error) {
      logLoadError('contatos', error);
    }
  }

  useEffect(() => {
    async function carregar() {
      carregarFinanceCostDefaults();
      const hasFreshCache =
        (eventosAdminCache.eventos || []).length > 0 &&
        Date.now() - Number(eventosAdminCache.updatedAt || 0) < EVENTOS_CACHE_TTL_MS;

      if (!hasFreshCache) {
        setCarregando(true);
        try {
          await Promise.allSettled([
            carregarEventos(),
            carregarPrecontracts(),
            carregarContracts(),
          ]);
          setCarregando(false);

          Promise.allSettled([
            carregarPricing(),
            carregarContatos(),
            carregarFinanceCostDefaults(),
          ]);
        } catch (error) {
          console.error('[EVENTOS] Falha inesperada ao carregar dados iniciais:', error);
          setCarregando(false);
        }
      }
    }

    if ((eventosAdminCache.eventos || []).length > 0) {
      setEventos(eventosAdminCache.eventos || []);
      setScaleSummaryByEventId(eventosAdminCache.scaleSummaryByEventId || new Map());
      setPrecontracts(eventosAdminCache.precontracts || []);
      setContracts(eventosAdminCache.contracts || []);
      setContatos(eventosAdminCache.contatos || []);
      if (eventosAdminCache.pricingId) setPricingId(eventosAdminCache.pricingId);
      if (eventosAdminCache.pricing) {
        setPricing((prev) => ({
          ...prev,
          ...eventosAdminCache.pricing,
        }));
      }
      setCarregando(false);
    }

    carregar();
  }, []);

  useEffect(() => {
    const existingIds = new Set(eventos.map((ev) => String(ev.id)));
    setSelectedEventIds((prev) => prev.filter((id) => existingIds.has(String(id))));
  }, [eventos]);

  function handleMonthFilterChange(value) {
    setMonthFilter(value);
    if (value !== 'all') {
      setViewMode((current) => (current === 'Mês atual' ? 'Todos' : current));
    }
  }

  function handleFormChange(field, value) {
    if (field === 'transport_price') {
      setForm((prev) => {
        const automaticCosts = getAutomaticCosts({
          formation: prev.formation,
          hasSound: !!prev.has_sound,
          hasTransport: toNumber(value) > 0,
          transportPrice: value,
          pricing: financeCostDefaults,
        });

        return {
          ...prev,
          transport_price: value,
          extra_transport_cost: String(automaticCosts.extraTransportCost || ''),
        };
      });
      return;
    }

    setForm((prev) => ({
      ...prev,
      [field]: field === 'event_time' ? normalizeTimeStrict(value) : value,
    }));
  }

  async function carregarPrecontracts() {
    try {
      const { data, error } = await supabase
        .from('precontracts')
        .select(PRECONTRACTS_SELECT_FIELDS)
        .order('created_at', { ascending: false })
        .limit(ADMIN_LIST_LIMIT);

      if (error) throw error;
      const sanitized = (data || []).map((item) => sanitizeTimeFields(item));
      setPrecontracts(sanitized);
      eventosAdminCache.precontracts = sanitized;
      eventosAdminCache.updatedAt = Date.now();
    } catch (error) {
      logLoadError('precontracts', error);
    }
  }

  async function carregarContracts() {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select(CONTRACTS_SELECT_FIELDS)
        .order('created_at', { ascending: false })
        .limit(ADMIN_LIST_LIMIT);

      if (error) throw error;
      const sanitized = (data || []).map((item) => sanitizeTimeFields(item));
      setContracts(sanitized);
      eventosAdminCache.contracts = sanitized;
      eventosAdminCache.updatedAt = Date.now();
    } catch (error) {
      logLoadError('contracts', error);
    }
  }

  function aplicarAutomaticosDaFormacao(
    nextFormation = form.formation,
    nextReceptionHours = form.reception_hours,
    nextHasSound = form.has_sound
  ) {
    const formationPrice = getAutomaticFormationPrice(nextFormation, pricing);
    const receptionPrice = getAutomaticReceptionPrice(
      nextFormation,
      nextReceptionHours,
      pricing
    );
    const soundPrice = nextHasSound ? toNumber(pricing.sound_price) : 0;
    const automaticCosts = getAutomaticCosts({
      formation: nextFormation,
      hasSound: !!nextHasSound,
      hasTransport: Boolean(form.has_transport),
      transportPrice: form.transport_price,
      pricing: financeCostDefaults,
    });

    setForm((prev) => ({
      ...prev,
      formation: nextFormation,
      reception_hours: String(nextReceptionHours),
      has_sound: !!nextHasSound,
      formation_price: String(formationPrice || ''),
      reception_price: String(receptionPrice || ''),
      sound_price: String(soundPrice || ''),
      musician_cost: String(automaticCosts.musicianCost || ''),
      sound_cost: String(automaticCosts.soundCost || ''),
      extra_transport_cost: String(automaticCosts.extraTransportCost || ''),
      other_cost: String(automaticCosts.otherCost || ''),
    }));
  }

  async function abrirContratoRapido(evento) {
  try {
    const contractInfo = contractsByEventId.get(String(evento.id));

    if (contractInfo?.link) {
      window.open(contractInfo.link, '_blank', 'noopener,noreferrer');
      setFeedback({
        type: 'info',
        title: 'Contrato disponível',
        message: `O contrato de ${evento.client_name || 'evento'} foi aberto em uma nova aba.`,
      });
      return;
    }

    setGerandoContratoId(evento.id);

    const precontract = await generatePrecontractFromEvent(evento);

    if (!precontract?.public_token) {
      throw new Error('Token não gerado');
    }

    await carregarPrecontracts();
    await carregarContracts();

    window.open(`/contrato/${precontract.public_token}`, '_blank', 'noopener,noreferrer');

    setFeedback({
      type: 'success',
      title: 'Contrato gerado',
      message: `O evento ${evento.client_name || ''} entrou no fluxo contratual e o link foi aberto em uma nova aba.`,
    });
  } catch (error) {
    console.error('Erro ao gerar contrato:', error);
    setFeedback({
      type: 'error',
      title: 'Erro ao gerar contrato',
      message: 'Não foi possível criar o fluxo contratual deste evento agora.',
    });
  } finally {
    setGerandoContratoId(null);
  }
}
  async function copiarLinkContrato(evento) {
  try {
    const contractInfo = contractsByEventId.get(String(evento.id));

    if (!contractInfo?.link) {
      setFeedback({
        type: 'info',
        title: 'Sem link disponível',
        message: 'Este evento ainda não possui link de contrato para copiar.',
      });
      return;
    }

    const fullLink =
      typeof window === 'undefined'
        ? contractInfo.link
        : `${window.location.origin}${contractInfo.link}`;

    await navigator.clipboard.writeText(fullLink);

    setFeedback({
      type: 'success',
      title: 'Link copiado',
      message: `O link do contrato de ${evento.client_name || 'evento'} foi copiado com sucesso.`,
    });
  } catch (error) {
    console.error('Erro ao copiar link do contrato:', error);
    setFeedback({
      type: 'error',
      title: 'Erro ao copiar link',
      message: 'Não foi possível copiar o link do contrato agora.',
    });
  }
}

  function iniciarEdicao(evento) {
    setEditandoId(evento.id);

    setForm({
      client_contact_id: evento.client_contact_id || '',
      client_name: evento.client_name || '',
      event_type: evento.event_type || '',
      event_date: evento.event_date || '',
      event_time: normalizeTimeStrict(evento.event_time || ''),
      duration_min: String(evento.duration_min ?? 60),
      location_name: evento.location_name || '',
      formation: evento.formation || '',
      instruments: evento.instruments || '',
      observations: evento.observations || '',
      guests_emails: evento.guests_emails || '',
      whatsapp_name: evento.whatsapp_name || '',
      whatsapp_phone: evento.whatsapp_phone || '',
      has_sound: !!evento.has_sound,
      reception_hours: String(evento.reception_hours ?? 0),

      formation_price: String(evento.formation_price ?? ''),
      sound_price: String(evento.sound_price ?? ''),
      reception_price: String(evento.reception_price ?? ''),
      transport_price: String(evento.transport_price ?? ''),

      paid_amount: String(evento.paid_amount ?? ''),

      musician_cost: String(evento.musician_cost ?? ''),
      sound_cost: String(evento.sound_cost ?? ''),
      extra_transport_cost: String(evento.extra_transport_cost ?? ''),
      other_cost: String(evento.other_cost ?? ''),

      status: evento.status || 'Rascunho',
    });

    setDesktopTab('evento');
    setMobileTab('evento');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(getInitialForm());
  }

  function abrirEscala(evento) {
    if (!evento?.id) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'escala');
    params.set('retorno', 'operacao');
    if (filaEscalaIds.length > 0) {
      params.set('filaEscala', filaEscalaIds.join(','));
    }
    if (visibleEventIds.length > 0) {
      params.set('lista', visibleEventIds.join(','));
    }
    router.push(`/eventos/${evento.id}?${params.toString()}`);
  }

  const financial = useMemo(() => {
    const formationPrice = toNumber(form.formation_price);
    const soundPrice = form.has_sound ? toNumber(form.sound_price) : 0;
    const receptionPrice = toNumber(form.reception_price);
    const transportPrice = toNumber(form.transport_price);

    const agreedAmount =
      formationPrice + soundPrice + receptionPrice + transportPrice;
    const paidAmount = toNumber(form.paid_amount);
    const openAmount = Math.max(0, agreedAmount - paidAmount);

    const musicianCost = toNumber(form.musician_cost);
    const soundCost = toNumber(form.sound_cost);
    const extraTransportCost = toNumber(form.extra_transport_cost);
    const otherCost = toNumber(form.other_cost);
    const totalCosts = musicianCost + soundCost + extraTransportCost + otherCost;
    const costBreakdown = buildCostBreakdown({
      musicianCost,
      soundCost,
      extraTransportCost,
      customCosts: financeCostDefaults.custom_costs,
    });

    const profitAmount = agreedAmount - totalCosts;
    const paymentStatus = getPaymentStatus(agreedAmount, paidAmount);

    return {
      formationPrice,
      soundPrice,
      receptionPrice,
      transportPrice,
      agreedAmount,
      paidAmount,
      openAmount,
      musicianCost,
      soundCost,
      extraTransportCost,
      otherCost,
      costBreakdown,
      totalCosts,
      profitAmount,
      paymentStatus,

      formationPriceFormatted: formatMoney(formationPrice),
      soundPriceFormatted: formatMoney(soundPrice),
      receptionPriceFormatted: formatMoney(receptionPrice),
      agreedAmountFormatted: formatMoney(agreedAmount),
      openAmountFormatted: formatMoney(openAmount),
      profitAmountFormatted: formatMoney(profitAmount),
    };
  }, [financeCostDefaults.custom_costs, form, pricing]);

  async function salvarPricing() {
    try {
      setSalvando(true);
      eventosAdminCache.updatedAt = 0;

      const pricingPayload = {
        slug: 'default',
        price_solo: toNumber(pricing.price_solo),
        price_duo: toNumber(pricing.price_duo),
        price_trio: toNumber(pricing.price_trio),
        price_quarteto: toNumber(pricing.price_quarteto),
        price_quinteto: toNumber(pricing.price_quinteto),
        price_sexteto: toNumber(pricing.price_sexteto),
        price_septeto: toNumber(pricing.price_septeto),
        sound_price: toNumber(pricing.sound_price),
        reception_duo_1h: toNumber(pricing.reception_duo_1h),
        reception_duo_2h: toNumber(pricing.reception_duo_2h),
        reception_duo_3h: toNumber(pricing.reception_duo_3h),
        reception_trio_1h: toNumber(pricing.reception_trio_1h),
        reception_trio_2h: toNumber(pricing.reception_trio_2h),
        reception_trio_3h: toNumber(pricing.reception_trio_3h),
        reception_quarteto_1h: toNumber(pricing.reception_quarteto_1h),
        reception_quarteto_2h: toNumber(pricing.reception_quarteto_2h),
        reception_quarteto_3h: toNumber(pricing.reception_quarteto_3h),
        reception_quinteto_1h: toNumber(pricing.reception_quinteto_1h),
        reception_quinteto_2h: toNumber(pricing.reception_quinteto_2h),
        reception_quinteto_3h: toNumber(pricing.reception_quinteto_3h),
        reception_sexteto_1h: toNumber(pricing.reception_sexteto_1h),
        reception_sexteto_2h: toNumber(pricing.reception_sexteto_2h),
        reception_sexteto_3h: toNumber(pricing.reception_sexteto_3h),
        reception_septeto_1h: toNumber(pricing.reception_septeto_1h),
        reception_septeto_2h: toNumber(pricing.reception_septeto_2h),
        reception_septeto_3h: toNumber(pricing.reception_septeto_3h),
        formation_prices: buildCanonicalFormationPrices(pricing),
      };

      if (pricing.formation_prices && typeof pricing.formation_prices === 'object') {
        pricingPayload.formation_prices = buildCanonicalFormationPrices(pricing);
      }

      const costPayload = {
        slug: 'default',
        musician_unit_cost: toNumber(pricing.musician_unit_cost),
        sound_default_cost: toNumber(pricing.sound_default_cost),
        transport_default_cost: toNumber(pricing.transport_default_cost),
        other_default_cost: toNumber(pricing.other_default_cost),
        notes: String(pricing.finance_notes || pricing.notes || ''),
        custom_costs: sanitizeCustomCosts(pricing.custom_costs),
      };

      console.info('[EVENTOS][PRICING_SAVE][START]', {
        pricingPayload,
        costPayload,
      });

      const { data: pricingData, error: pricingError } = await supabase
        .from('pricing_settings')
        .upsert(pricingPayload, { onConflict: 'slug' })
        .select('id')
        .single();

      if (pricingError) throw pricingError;

      let financeDefaultsError = null;
      const { error: financeError } = await supabase
        .from('finance_cost_defaults')
        .upsert(costPayload, { onConflict: 'slug' });

      if (financeError) {
        financeDefaultsError = financeError;
        console.error('[EVENTOS][PRICING_SAVE][FINANCE_COST_DEFAULTS_ERROR]', {
          message: financeError?.message,
          details: financeError?.details,
          hint: financeError?.hint,
          code: financeError?.code,
        });
      }

      console.info('[EVENTOS][PRICING_SAVE][UPSERT_OK]');

      const { data: reloadedPricing, error: reloadPricingError } = await supabase
        .from('pricing_settings')
        .select(PRICING_SELECT_FIELDS)
        .eq('slug', 'default')
        .maybeSingle();

      if (reloadPricingError) throw reloadPricingError;
      if (!reloadedPricing) {
        throw new Error('pricing_settings.default não retornou após salvar.');
      }

      let reloadedCosts = null;
      const { data: costsData, error: reloadCostsError } = await supabase
        .from('finance_cost_defaults')
        .select(
          'id, slug, musician_unit_cost, sound_default_cost, transport_default_cost, other_default_cost, custom_costs, notes'
        )
        .eq('slug', 'default')
        .maybeSingle();

      if (reloadCostsError) {
        if (!financeDefaultsError) throw reloadCostsError;
      } else {
        reloadedCosts = costsData;
      }

      console.info('[EVENTOS][PRICING_SAVE][RELOAD_OK]', {
        pricingId: reloadedPricing?.id,
        costDefaultsId: reloadedCosts?.id,
        priceSolo: reloadedPricing?.price_solo,
        musicianUnitCost: reloadedCosts?.musician_unit_cost,
      });

      const normalizedReloadedPricing = hydratePricingFromCanonical(reloadedPricing);
      const normalizedReloadedCosts = reloadedCosts
        ? {
            musician_unit_cost: toNumber(reloadedCosts.musician_unit_cost),
            sound_default_cost: toNumber(reloadedCosts.sound_default_cost),
            transport_default_cost: toNumber(reloadedCosts.transport_default_cost),
            other_default_cost: toNumber(reloadedCosts.other_default_cost),
            custom_costs: sanitizeCustomCosts(reloadedCosts.custom_costs),
            notes: String(reloadedCosts.notes || ''),
          }
        : null;
      const combinedPricing = {
        ...normalizedReloadedPricing,
        musician_unit_cost: normalizedReloadedCosts?.musician_unit_cost ?? toNumber(pricing.musician_unit_cost),
        sound_default_cost: normalizedReloadedCosts?.sound_default_cost ?? toNumber(pricing.sound_default_cost),
        transport_default_cost:
          normalizedReloadedCosts?.transport_default_cost ?? toNumber(pricing.transport_default_cost),
        other_default_cost: normalizedReloadedCosts?.other_default_cost ?? toNumber(pricing.other_default_cost),
        custom_costs: normalizedReloadedCosts?.custom_costs ?? sanitizeCustomCosts(pricing.custom_costs),
        finance_notes: normalizedReloadedCosts?.notes ?? String(pricing.finance_notes || pricing.notes || ''),
      };

      const pricingConfirmed = PRICING_FIELDS_TO_CONFIRM.every(
        (field) => toNumber(reloadedPricing?.[field]) === toNumber(pricingPayload?.[field])
      );
      const costsConfirmed = COST_FIELDS_TO_CONFIRM.every((field) => {
        if (!normalizedReloadedCosts) return false;
        return toNumber(normalizedReloadedCosts?.[field]) === toNumber(costPayload?.[field]);
      });
      const shouldConfirmCosts = !financeDefaultsError;
      const hasConfirmedReload = pricingConfirmed && (!shouldConfirmCosts || costsConfirmed);

      setPricing((prev) => ({
        ...prev,
        ...combinedPricing,
      }));

      if (normalizedReloadedCosts) {
        setFinanceCostDefaults(normalizedReloadedCosts);
      } else {
        setFinanceCostDefaults({
          musician_unit_cost: toNumber(pricing.musician_unit_cost),
          sound_default_cost: toNumber(pricing.sound_default_cost),
          transport_default_cost: toNumber(pricing.transport_default_cost),
          other_default_cost: toNumber(pricing.other_default_cost),
          custom_costs: sanitizeCustomCosts(pricing.custom_costs),
          notes: String(pricing.finance_notes || pricing.notes || ''),
        });
      }

      if (reloadedPricing?.id || pricingData?.id) {
        const nextPricingId = reloadedPricing?.id || pricingData?.id;
        setPricingId(nextPricingId);
        eventosAdminCache.pricingId = nextPricingId;
      }

      eventosAdminCache.pricing = combinedPricing;
      eventosAdminCache.updatedAt = Date.now();

      if (!hasConfirmedReload) {
        toast.warning(
          'Os dados foram enviados, mas não retornaram atualizados. Verifique as permissões ou o banco.'
        );
      } else if (financeDefaultsError) {
        toast.warning('Preços salvos, mas não foi possível salvar custos padrão.');
      } else {
        toast.success('Configuração de preços salva com sucesso.');
      }
    } catch (error) {
      console.error('[EVENTOS][PRICING_SAVE_ERROR]', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });
      toast.error('Erro ao salvar configuração de preços.');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarEvento() {
    if (!form.client_name.trim()) {
      toast.warning('Informe o contratante / cliente.');
      return;
    }

    if (!form.event_date) {
      toast.warning('Informe a data do evento.');
      return;
    }

    if (!form.event_time) {
      toast.warning('Informe a hora do evento.');
      return;
    }

    if (!isValidTime(form.event_time)) {
      toast.warning('Informe um horário válido no formato HH:mm.');
      return;
    }

    if (!form.location_name.trim()) {
      toast.warning('Informe o local do evento.');
      return;
    }

    try {
      setSalvando(true);

      console.log('[TIME AUDIT]', {
        flow: 'criacao-evento',
        original: form.event_time,
        normalized: normalizeTimeStrict(form.event_time),
      });

      const payload = {
        client_contact_id: form.client_contact_id || null,
        client_name: form.client_name.trim(),
        event_type: form.event_type || null,
        event_date: form.event_date || null,
        event_time: normalizeTimeStrict(form.event_time) || null,
        duration_min: parseInt(form.duration_min, 10) || 60,
        location_name: form.location_name.trim() || null,
        formation: normalizeFormation(form.formation),
        instruments: form.instruments.trim() || null,
        observations: form.observations.trim() || null,
        guests_emails: form.guests_emails.trim() || null,
        whatsapp_name: form.whatsapp_name.trim() || null,
        whatsapp_phone: cleanPhone(form.whatsapp_phone),
        has_sound: !!form.has_sound,
        has_transport: toNumber(form.transport_price) > 0,
        reception_hours: parseInt(form.reception_hours, 10) || 0,

        formation_price: financial.formationPrice,
        sound_price: financial.soundPrice,
        reception_price: financial.receptionPrice,
        transport_price: financial.transportPrice,

        agreed_amount: financial.agreedAmount,
        paid_amount: financial.paidAmount,
        open_amount: financial.openAmount,
        payment_status: financial.paymentStatus,

        musician_cost: financial.musicianCost,
        sound_cost: financial.soundCost,
        extra_transport_cost: financial.extraTransportCost,
        other_cost: financial.otherCost,
        profit_amount: financial.profitAmount,
        cost_breakdown: financial.costBreakdown,

        status: form.status || 'Rascunho',
      };

      if (editandoId) {
        const { error } = await supabase
          .from('events')
          .update(payload)
          .eq('id', editandoId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('events').insert([{
          ...payload,
          costs_source: 'default',
        }]);

        if (error) throw error;
      }

      cancelarEdicao();
      await carregarEventos();
      setMobileTab('lista');
      toast.success(editandoId ? 'Evento atualizado com sucesso.' : 'Evento criado com sucesso.');
    } catch (error) {
      console.error('Erro ao salvar evento:', error);
      toast.error('Erro ao salvar evento. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  function registrarPagamentoRapido(evento) {
    iniciarEdicao(evento);
    setDesktopTab('evento');
    setMobileTab('evento');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function solicitarExclusaoEvento(evento) {
    console.info('[EVENT_DELETE][CLICK]', {
      eventId: evento?.id,
      eventName: evento?.client_name || null,
    });
    setDeleteDialog({
      open: true,
      eventId: evento?.id || null,
      eventName: evento?.client_name || '',
    });
  }

  function cancelarSolicitacaoExclusao() {
    setDeleteDialog({
      open: false,
      eventId: null,
      eventName: '',
    });
  }

  function toggleEventoSelecionado(eventId, checked) {
    const normalizedId = String(eventId || '').trim();
    if (!normalizedId) return;

    setSelectedEventIds((prev) => {
      const set = new Set(prev.map((id) => String(id)));
      if (checked) set.add(normalizedId);
      else set.delete(normalizedId);
      return Array.from(set);
    });
  }

  function toggleSelecionarTodosVisiveis(checked) {
    setSelectedEventIds((prev) => {
      const set = new Set(prev.map((id) => String(id)));
      for (const eventId of visibleEventIds) {
        if (checked) set.add(String(eventId));
        else set.delete(String(eventId));
      }
      return Array.from(set);
    });
  }

  function limparSelecaoEventos() {
    setSelectedEventIds([]);
  }

  function abrirConfirmacaoExclusaoEmMassa() {
    if (selectedEventIds.length === 0) return;
    console.info('[EVENT_BULK_DELETE][OPEN_CONFIRM]', {
      selectedCount: selectedEventIds.length,
      selectedIds: selectedEventIds,
    });
    setBulkDeleteDialogOpen(true);
  }

  async function confirmarExclusaoEmMassa() {
    if (selectedEventIds.length === 0) {
      setBulkDeleteDialogOpen(false);
      return;
    }

    const targetIds = [...selectedEventIds];
    console.info('[EVENT_BULK_DELETE][REQUEST_START]', {
      selectedCount: targetIds.length,
      eventIds: targetIds,
    });

    setBulkDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const response = await fetch('/api/events/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ eventIds: targetIds }),
      });
      const res = await response.json();
      console.log('[DELETE_RESULT]', res);

      if (!response.ok || !res?.success) {
        throw new Error(res?.message || 'Não foi possível excluir os eventos selecionados.');
      }

      const deletedIds = (res.ids || []).map((id) => String(id)).filter(Boolean);

      if (deletedIds.length > 0) {
        setEventos((prev) => prev.filter((item) => !deletedIds.includes(String(item.id))));
      }

      await Promise.allSettled([carregarEventos(), carregarPrecontracts(), carregarContracts()]);
      console.info('[EVENT_BULK_DELETE][POST_RELOAD]', {
        deletedCount: deletedIds.length,
        failedCount: 0,
      });

      limparSelecaoEventos();
      setFeedback({
        type: 'success',
        title: 'Exclusão em massa concluída',
        message: res.message || `${res.affected || 0} itens processados`,
      });

      console.info('[EVENT_BULK_DELETE][SUMMARY]', {
        requested: targetIds.length,
        deletedCount: deletedIds.length,
        failedCount: 0,
        failedIds: [],
      });
    } catch (error) {
      console.error('[EVENT_BULK_DELETE][SUMMARY]', {
        requested: targetIds.length,
        error: error?.message,
      });
      setFeedback({
        type: 'error',
        title: 'Erro na exclusão em massa',
        message: error?.message || 'Não foi possível concluir a exclusão em massa.',
      });
    } finally {
      setBulkDeleting(false);
      setBulkDeleteDialogOpen(false);
    }
  }

  async function excluirEvento(id) {
    console.info('[EVENT_DELETE][CONFIRMED]', { eventId: id });
    console.info('[EVENT_DELETE][REQUEST_START]', { eventId: id });
    console.info('[EVENT_DELETE][REQUEST_PAYLOAD]', { eventId: id });
    setExcluindoEventoId(id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const response = await fetch(`/api/events/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
      const result = await response.json();
      console.info('[EVENT_DELETE][DEPENDENCY_CHECK]', {
        eventId: id,
        dependencies: result?.dependencies || [],
      });

      if (!response.ok || !result?.ok) {
        console.error('[EVENT_DELETE][DB_DELETE_ERROR]', {
          eventId: id,
          status: response.status,
          message: result?.error,
          dependencies: result?.dependencies || [],
        });
        const dependencyMessage = Array.isArray(result?.dependencies) && result.dependencies.length
          ? `Vínculos pendentes: ${result.dependencies
              .map((dep) => dep?.message || dep?.table)
              .filter(Boolean)
              .join(' | ')}`
          : '';
        setFeedback({
          type: 'error',
          title: 'Erro ao excluir evento',
          message:
            result?.error ||
            dependencyMessage ||
            'Não foi possível excluir o evento agora. Verifique dependências e tente novamente.',
        });
        return;
      }

      console.info('[EVENT_DELETE][DB_DELETE_RESULT]', {
        eventId: id,
        deletedId: result?.deletedId || null,
      });

      if (editandoId === id) {
        cancelarEdicao();
      }

      console.info('[EVENT_DELETE][POST_DELETE_RELOAD]', {
        eventId: id,
        action: 'start_reload',
      });
      await carregarEventos();
      await Promise.allSettled([carregarPrecontracts(), carregarContracts()]);
      console.info('[EVENT_DELETE][POST_DELETE_RELOAD]', {
        eventId: id,
        action: 'finish_reload',
      });

      setFeedback({
        type: 'success',
        title: 'Evento excluído',
        message: 'O evento foi removido com sucesso.',
      });
    } catch (error) {
      console.error('[EVENT_DELETE][DB_DELETE_ERROR]', {
        eventId: id,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        full: error,
      });
      setFeedback({
        type: 'error',
        title: 'Erro ao excluir evento',
        message:
          error?.message ||
          'Não foi possível excluir o evento agora. Verifique dependências e tente novamente.',
      });
    } finally {
      setExcluindoEventoId(null);
      cancelarSolicitacaoExclusao();
      console.info('[EVENT_DELETE][FINAL_UI_STATE]', {
        eventId: id,
        totalEventosState: eventos.length,
      });
    }
  }

  async function confirmarRapido(evento) {
    const { error } = await supabase
      .from('events')
      .update({ status: 'Confirmado' })
      .eq('id', evento.id);

    if (error) {
      toast.error('Não foi possível confirmar o evento.');
      return;
    }

    setEventos((prev) =>
      prev.map((item) =>
        item.id === evento.id ? { ...item, status: 'Confirmado' } : item
      )
    );
    toast.success('Evento confirmado com sucesso.');
  }

  const availableMonthOptions = useMemo(() => {
    const unique = Array.from(
      new Set(eventos.map((ev) => getMonthKey(ev.event_date)).filter(Boolean))
    );

    unique.sort((a, b) => a.localeCompare(b));

    return unique.map((key) => ({
      value: key,
      label: formatMonthYearLabel(key),
    }));
  }, [eventos]);

  const eventosFiltrados = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const termo = busca.trim().toLowerCase();

    let lista = [...eventos];

    if (viewMode === 'Mês atual') {
      lista = lista.filter((ev) => {
        if (!ev.event_date) return false;
        const d = new Date(`${ev.event_date}T00:00:00`);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
    } else if (viewMode === 'Realizados') {
      lista = lista.filter((ev) => isPastEvent(ev.event_date));
    }

    if (monthFilter !== 'all') {
      lista = lista.filter((ev) => getMonthKey(ev.event_date) === monthFilter);
    }

    if (termo) {
      lista = lista.filter((ev) =>
        [
          ev.client_name,
          ev.event_type,
          ev.location_name,
          ev.formation,
          ev.instruments,
          ev.whatsapp_name,
          ev.whatsapp_phone,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(termo))
      );
    }

    if (sortMode === 'Data do evento') {
      lista.sort((a, b) => {
        const aDate = a.event_date
          ? new Date(`${a.event_date}T${normalizeTimeStrict(a.event_time) || '00:00'}`).getTime()
          : 0;
        const bDate = b.event_date
          ? new Date(`${b.event_date}T${normalizeTimeStrict(b.event_time) || '00:00'}`).getTime()
          : 0;
        return aDate - bDate;
      });
    } else {
      lista.sort((a, b) => {
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bDate - aDate;
      });
    }

    return lista;
  }, [eventos, viewMode, monthFilter, sortMode, busca]);

  const selectedEventIdsSet = useMemo(
    () => new Set(selectedEventIds.map((id) => String(id))),
    [selectedEventIds]
  );

  const visibleEventIds = useMemo(
    () => eventosFiltrados.map((ev) => String(ev.id)),
    [eventosFiltrados]
  );

  const filaEscalaIds = useMemo(
    () =>
      eventosFiltrados
        .map((evento) => String(evento.id || '').trim())
        .filter(Boolean),
    [eventosFiltrados]
  );

  const selectedVisibleCount = useMemo(
    () => visibleEventIds.filter((id) => selectedEventIdsSet.has(id)).length,
    [visibleEventIds, selectedEventIdsSet]
  );

  const allVisibleSelected =
    visibleEventIds.length > 0 && selectedVisibleCount === visibleEventIds.length;

  const contractsByEventId = useMemo(() => {
    const map = new Map();

    const contractsByPreId = new Map(
      contracts.map((item) => [String(item.precontract_id), item])
    );

    for (const pre of precontracts) {
      const contract = contractsByPreId.get(String(pre.id));

      const eventId = contract?.event_id || pre?.event_id;
      if (!eventId) continue;

      const rawStatus = contract?.status || pre?.status || '';
      const s = String(rawStatus).toLowerCase();

      let label = 'Sem contrato';
      let tone = 'default';

      if (s === 'signed') {
        label = 'Contrato assinado';
        tone = 'emerald';
      } else if (s === 'client_filling') {
        label = 'Preenchendo contrato';
        tone = 'violet';
      } else if (s === 'link_generated') {
        label = 'Link do contrato gerado';
        tone = 'blue';
      }

      map.set(String(eventId), {
        precontractId: pre.id,
        contractId: contract?.id || null,
        token: pre.public_token || contract?.public_token || '',
        link: pre.public_token || contract?.public_token
          ? `/contrato/${pre.public_token || contract?.public_token}`
          : '',
        status: rawStatus,
        label,
        tone,
        signedAt: contract?.signed_at || '',
        pdfUrl: contract?.pdf_url || '',
        docUrl: contract?.doc_url || '',
      });
    }

    return map;
  }, [precontracts, contracts]);

  const eventosOperacionais = useMemo(() => {
    return eventosFiltrados.filter((ev) => {
      const contratoPendente = isContratoPendente(ev, contractsByEventId);
      const pagamentoPendente = isFinanceiroPendente(ev);
      const eventoProximo = isUpcomingEvent(ev.event_date, 7);
      const rascunho = isRascunho(ev);

      return contratoPendente || pagamentoPendente || eventoProximo || rascunho;
    });
  }, [eventosFiltrados, contractsByEventId]);

  const eventosOperacionaisFiltrados = useMemo(() => {
    switch (operacaoFiltro) {
      case 'contrato':
        return eventosOperacionais.filter((ev) =>
          isContratoPendente(ev, contractsByEventId)
        );

      case 'financeiro':
        return eventosOperacionais.filter((ev) => isFinanceiroPendente(ev));

      case 'proximos':
        return eventosOperacionais.filter((ev) =>
          isUpcomingEvent(ev.event_date, 7)
        );

      case 'rascunhos':
        return eventosOperacionais.filter((ev) => isRascunho(ev));

      case 'todos':
      default:
        return eventosOperacionais;
    }
  }, [operacaoFiltro, eventosOperacionais, contractsByEventId]);

  const resumoOperacao = useMemo(() => {
    const financeiros = eventosOperacionais.filter((ev) =>
      isFinanceiroPendente(ev)
    ).length;

    const contratos = eventosOperacionais.filter((ev) =>
      isContratoPendente(ev, contractsByEventId)
    ).length;

    const proximos = eventosOperacionais.filter((ev) =>
      isUpcomingEvent(ev.event_date, 7)
    ).length;

    const rascunhos = eventosOperacionais.filter((ev) =>
      isRascunho(ev)
    ).length;

    let prioridadeLabel = 'Operação sob controle';
    let prioridadeTone = 'emerald';

    if (financeiros > 0) {
      prioridadeLabel = `${financeiros} evento(s) com financeiro pendente`;
      prioridadeTone = 'amber';
    } else if (contratos > 0) {
      prioridadeLabel = `${contratos} evento(s) com contrato pendente`;
      prioridadeTone = 'violet';
    } else if (rascunhos > 0) {
      prioridadeLabel = `${rascunhos} evento(s) em rascunho`;
      prioridadeTone = 'slate';
    } else if (proximos > 0) {
      prioridadeLabel = `${proximos} evento(s) nos próximos 7 dias`;
      prioridadeTone = 'blue';
    }

    return {
      financeiros,
      contratos,
      proximos,
      rascunhos,
      prioridadeLabel,
      prioridadeTone,
    };
  }, [eventosOperacionais, contractsByEventId]);

  const resumo = useMemo(() => {
    const visiveis = eventosFiltrados;
    const total = visiveis.length;

    const totalAberto = visiveis.reduce(
      (acc, ev) => acc + toNumber(ev.open_amount),
      0
    );

    const totalAcertado = visiveis.reduce(
      (acc, ev) => acc + toNumber(ev.agreed_amount),
      0
    );

    const totalLucro = visiveis.reduce(
      (acc, ev) => acc + toNumber(ev.profit_amount),
      0
    );

    return {
      total,
      totalAberto,
      totalAcertado,
      totalLucro,
      totalAbertoFormatado: formatMoney(totalAberto),
      totalAcertadoFormatado: formatMoney(totalAcertado),
      totalLucroFormatado: formatMoney(totalLucro),
    };
  }, [eventosFiltrados]);

  const mobileTabs = [
    { key: 'resumo', label: 'Resumo' },
    { key: 'evento', label: editandoId ? 'Editar' : 'Novo evento' },
    { key: 'lista', label: 'Lista' },
    { key: 'precos', label: 'Preços' },
  ];

  const mobileActions = (
    <button
      type="button"
      onClick={() => setMobileTab('evento')}
      className="rounded-[16px] bg-[#0f172a] px-4 py-3 text-[13px] font-black text-white"
    >
      Novo
    </button>
  );

  function renderLista() {
    return (
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
        <AdminSectionTitle
          title={EVENTOS_LIST_TITLE}
          subtitle={EVENTOS_LIST_SUBTITLE}
        />

        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, local, formação..."
          />

          <Select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
            {VIEW_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </Select>

          <Select value={monthFilter} onChange={(e) => handleMonthFilterChange(e.target.value)}>
            <option value="all">Todos os meses</option>
            {availableMonthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <Select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
            {SORT_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </Select>
        </div>

        <div className="mb-5 flex flex-col gap-3 rounded-[20px] border border-[#dbe3ef] bg-[#f8fafc] p-4 md:flex-row md:items-center md:justify-between">
          <label className="inline-flex items-center gap-3 text-[13px] font-black text-[#334155]">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={(event) => toggleSelecionarTodosVisiveis(event.target.checked)}
              className="h-4 w-4 rounded border-[#cbd5e1] text-violet-600 focus:ring-violet-500"
            />
            Selecionar todos os visíveis ({eventosFiltrados.length})
          </label>

          {selectedEventIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <span className="rounded-[14px] bg-white px-3 py-2 text-[12px] font-black text-[#334155]">
                {selectedEventIds.length} selecionado(s)
              </span>
              <button
                type="button"
                onClick={limparSelecaoEventos}
                className="rounded-[14px] border border-[#dbe3ef] bg-white px-3 py-2 text-[12px] font-black text-[#0f172a]"
              >
                Limpar seleção
              </button>
              <button
                type="button"
                onClick={abrirConfirmacaoExclusaoEmMassa}
                disabled={bulkDeleting}
                className="rounded-[14px] bg-red-600 px-3 py-2 text-[12px] font-black text-white shadow-[0_10px_22px_rgba(220,38,38,0.22)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Excluir selecionados
              </button>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          {eventosFiltrados.length === 0 ? (
            <div className="rounded-[20px] bg-[#f8fafc] px-4 py-5 text-[14px] font-semibold text-[#64748b]">
              Nenhum evento encontrado.
            </div>
          ) : (
            eventosFiltrados.map((ev) => {
              const timeline = getTimelineLabel(ev.event_date);
              const contractInfo = contractsByEventId.get(String(ev.id));
              const scaleSummary = scaleSummaryByEventId.get(String(ev.id)) || {
                totalMusicians: 0,
                confirmedMusicians: 0,
              };

              return (
               <AdminEventCard
  key={ev.id}
  id={ev.id}
  cliente={ev.client_name}
  tipo={ev.event_type || 'Evento'}
  data={formatDateBR(ev.event_date)}
  hora={normalizeTimeStrict(ev.event_time) || '-'}
  local={ev.location_name || '-'}
  formacao={ev.formation || '-'}
  receptivo={ev.reception_hours ? `${ev.reception_hours}h` : 'Não'}
  antesala={
    ev.has_antesala
      ? ev.antesala_duration_minutes
        ? `${ev.antesala_duration_minutes} min`
        : 'Incluída'
      : ev.antesala_requested_by_client
      ? 'Solicitada'
      : 'Não'
  }
  temSom={!!ev.has_sound}
  whatsappNome={ev.whatsapp_name || '-'}
  whatsappNumero={formatPhoneDisplay(ev.whatsapp_phone)}
  observacoes={ev.observations}
  valorAcertado={formatMoney(ev.agreed_amount)}
  valorPago={formatMoney(ev.paid_amount)}
  valorAberto={formatMoney(ev.open_amount)}
  lucroFinal={formatMoney(ev.profit_amount)}
  paymentStatus={ev.payment_status || 'Pendente'}
  operationalStatus={ev.status || 'Rascunho'}
  timelineText={timeline.text}
  timelineTone={timeline.tone}
  event={ev}
  totalMusicians={scaleSummary.totalMusicians}
  confirmedMusicians={scaleSummary.confirmedMusicians}
  contractLabel={contractInfo?.label || 'Sem contrato'}
  contractTone={contractInfo?.tone || 'default'}
  contractLink={contractInfo?.link || ''}
  onEdit={() => iniciarEdicao(ev)}
  onDelete={() => solicitarExclusaoEvento(ev)}
  onOpenEscala={() => abrirEscala(ev)}
  onOpenContract={() => abrirContratoRapido(ev)}
  onCopyContractLink={() => copiarLinkContrato(ev)}
  gerandoContrato={gerandoContratoId === ev.id}
  excluindo={excluindoEventoId === ev.id}
  selectable
  selected={selectedEventIdsSet.has(String(ev.id))}
  onToggleSelect={(checked) => toggleEventoSelecionado(ev.id, checked)}
/>
              );
            })
          )}
        </div>
      </section>
    );
  }

  if (carregando) {
    return (
      <AdminShell
        pageTitle="Eventos"
        mobileActions={mobileActions}
        activeItem="eventos"
      >
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <p className="text-center text-[#64748b]">Carregando eventos...</p>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      pageTitle="Eventos"
      mobileActions={mobileActions}
      activeItem="eventos"
    >
      <div className="space-y-5">
        {feedback ? (
  <FeedbackBanner
    feedback={feedback}
    onClose={() => setFeedback(null)}
  />
) : null}

        <DeleteEventDialog
          open={deleteDialog.open}
          eventName={deleteDialog.eventName}
          loading={
            !!excluindoEventoId &&
            String(excluindoEventoId) === String(deleteDialog.eventId)
          }
          onCancel={cancelarSolicitacaoExclusao}
          onConfirm={() => excluirEvento(deleteDialog.eventId)}
        />
        <BulkDeleteDialog
          open={bulkDeleteDialogOpen}
          quantity={selectedEventIds.length}
          loading={bulkDeleting}
          onCancel={() => setBulkDeleteDialogOpen(false)}
          onConfirm={confirmarExclusaoEmMassa}
        />
        <AdminPageHero
          badge="Harmonics Admin"
          title="Eventos"
          subtitle="Crie, acompanhe e gerencie eventos com visão operacional e financeira."
          actions={
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setDesktopTab('precos');
                  setMobileTab('precos');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="rounded-[18px] border border-[#dbe3ef] bg-white px-5 py-4 text-[14px] font-black text-[#0f172a]"
              >
                Preços automáticos
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditandoId(null);
                  setForm(getInitialForm());
                  setDesktopTab('evento');
                  setMobileTab('evento');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="rounded-[18px] bg-violet-600 px-5 py-4 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]"
              >
                Novo evento
              </button>
            </div>
          }
        />

        <div className="hidden md:block">
          <div className="rounded-[24px] border border-[#dbe3ef] bg-white p-2 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
            <div className="flex flex-wrap gap-2">
              {DESKTOP_TABS.map((tab) => {
                const active = desktopTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setDesktopTab(tab.key)}
                    className={`rounded-[18px] px-4 py-3 text-[14px] font-black transition ${
                      active
                        ? 'bg-violet-600 text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]'
                        : 'bg-[#f8fafc] text-[#475569] hover:bg-[#eef2ff]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="hidden md:block space-y-5">
          {desktopTab === 'visao' && (
            <>
              <EventosResumoTab
                resumo={resumo}
                resumoOperacao={resumoOperacao}
                eventosFiltrados={eventosFiltrados}
                setDesktopTab={setDesktopTab}
                setMobileTab={setMobileTab}
                setOperacaoFiltro={setOperacaoFiltro}
                iniciarEdicao={iniciarEdicao}
                formatDateBR={formatDateBR}
                getTimelineLabel={getTimelineLabel}
              />
              {renderLista()}
            </>
          )}

          {desktopTab === 'operacao' && (
           <EventosOperacaoTab
  eventosOperacionais={eventosOperacionais}
  eventosOperacionaisFiltrados={eventosOperacionaisFiltrados}
  resumoOperacao={resumoOperacao}
  operacaoFiltro={operacaoFiltro}
  setOperacaoFiltro={setOperacaoFiltro}
  contractsByEventId={contractsByEventId}
  contratoAbertoId={contratoAbertoId}
  setContratoAbertoId={setContratoAbertoId}
  iniciarEdicao={iniciarEdicao}
  confirmarRapido={confirmarRapido}
  salvarPagamento={salvarPagamento}
  pagamentoAbertoId={pagamentoAbertoId}
  setPagamentoAbertoId={setPagamentoAbertoId}
  valorPagamento={valorPagamento}
  setValorPagamento={setValorPagamento}
  salvandoPagamentoId={salvandoPagamentoId}
  ultimoPagamentoAtualizadoId={ultimoPagamentoAtualizadoId}
  setDesktopTab={setDesktopTab}
  setMobileTab={setMobileTab}
  getContractStatus={getContractStatus}
  getOperacaoAlert={getOperacaoAlert}
  getQuickActions={getQuickActions}
  getOperacaoPrimaryAction={getOperacaoPrimaryAction}
  isContratoPendente={isContratoPendente}
  isFinanceiroPendente={isFinanceiroPendente}
  isUpcomingEvent={isUpcomingEvent}
  isRascunho={isRascunho}
  getTimelineLabel={getTimelineLabel}
  getOperationalTone={getOperationalTone}
  getPaymentTone={getPaymentTone}
  getPriorityBannerClasses={getPriorityBannerClasses}
  formatMoney={formatMoney}
  formatDateBR={formatDateBR}
  formatPhoneDisplay={formatPhoneDisplay}
  onOpenContract={abrirContratoRapido}
  onCopyContractLink={copiarLinkContrato}
  gerandoContratoId={gerandoContratoId}
/>
          )}

          {desktopTab === 'evento' && (
            <EventosFormularioTab
              editandoId={editandoId}
              contatos={contatos}
              form={form}
              handleFormChange={handleFormChange}
              aplicarAutomaticosDaFormacao={aplicarAutomaticosDaFormacao}
              financial={financial}
              salvarEvento={salvarEvento}
              cancelarEdicao={cancelarEdicao}
              salvando={salvando}
              EVENT_TYPES={EVENT_TYPES}
              FORMATIONS={FORMATIONS}
              formatPhoneDisplay={formatPhoneDisplay}
              getPaymentTone={getPaymentTone}
              toast={toast}
            />
          )}

          {desktopTab === 'precos' && (
            <EventosPricingTab
              pricing={pricing}
              setPricing={setPricing}
              salvarPricing={salvarPricing}
              salvando={salvando}
            />
          )}
        </div>

        <div className="md:hidden">
          <AdminSegmentTabs
            items={mobileTabs}
            active={safeMobileTab}
            onChange={setMobileTab}
          />
        </div>

        <div className="space-y-5 md:hidden">
          {safeMobileTab === 'resumo' && (
            <EventosResumoTab
              resumo={resumo}
              resumoOperacao={resumoOperacao}
              eventosFiltrados={eventosFiltrados}
              setDesktopTab={setDesktopTab}
              setMobileTab={setMobileTab}
              setOperacaoFiltro={setOperacaoFiltro}
              iniciarEdicao={iniciarEdicao}
              formatDateBR={formatDateBR}
              getTimelineLabel={getTimelineLabel}
            />
          )}

          {safeMobileTab === 'evento' && (
            <EventosFormularioTab
              editandoId={editandoId}
              contatos={contatos}
              form={form}
              handleFormChange={handleFormChange}
              aplicarAutomaticosDaFormacao={aplicarAutomaticosDaFormacao}
              financial={financial}
              salvarEvento={salvarEvento}
              cancelarEdicao={cancelarEdicao}
              salvando={salvando}
              EVENT_TYPES={EVENT_TYPES}
              FORMATIONS={FORMATIONS}
              formatPhoneDisplay={formatPhoneDisplay}
              getPaymentTone={getPaymentTone}
              toast={toast}
            />
          )}

          {safeMobileTab === 'lista' && renderLista()}

          {safeMobileTab === 'precos' && (
            <EventosPricingTab
              pricing={pricing}
              setPricing={setPricing}
              salvarPricing={salvarPricing}
              salvando={salvando}
            />
          )}
        </div>
      </div>

    </AdminShell>
  );
}
