'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
import EventosOperacaoTab from '@/components/eventos/EventosOperacaoTab';
import EventosResumoTab from '@/components/eventos/EventosResumoTab';
import EventosPricingTab from '@/components/eventos/EventosPricingTab';
import EventosFormularioTab from '@/components/eventos/EventosFormularioTab';
import EventoEscalaTab from '@/components/eventos/EventoEscalaTab';
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
  getAutomaticFormationPrice,
  getAutomaticReceptionPrice,
  getPaymentStatus,
  getPaymentTone,
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

export default function EventosPage() {
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
  const [feedback, setFeedback] = useState(null);

  const [viewMode, setViewMode] = useState('Mês atual');
  const [monthFilter, setMonthFilter] = useState('all');
  const [sortMode, setSortMode] = useState('Data do evento');
  const [busca, setBusca] = useState('');

  const [showPricing, setShowPricing] = useState(false);
  const [pricingId, setPricingId] = useState(null);
  const [pricing, setPricing] = useState(getDefaultPricing());

  const [form, setForm] = useState(getInitialForm());
  const [mobileTab, setMobileTab] = useState('resumo');
  const [desktopTab, setDesktopTab] = useState('visao');
  const [escalaAberta, setEscalaAberta] = useState(false);
  const [eventoEscala, setEventoEscala] = useState(null);

  async function carregarEventos() {
    try {
      const { data, error } = await supabase.from('events').select('*');

      if (error) throw error;
      setEventos((data || []).map((item) => sanitizeTimeFields(item)));
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
      alert('Erro ao carregar eventos. Tente novamente mais tarde.');
    }
  }

  async function salvarPagamento(ev, tipo = 'total') {
    const valor = Number(valorPagamento || 0);

    if (!valor && tipo === 'parcial') {
      alert('Informe um valor');
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
      alert('Erro ao salvar pagamento');
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
        .select('*')
        .eq('slug', 'default')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setPricingId(data.id);
        setPricing((prev) => ({
          ...prev,
          ...data,
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar pricing:', error);
    }
  }

  async function carregarContatos() {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, name, email, phone');

    if (!error) setContatos(data || []);
  }

  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);

      await Promise.all([
        carregarEventos(),
        carregarPricing(),
        carregarContatos(),
        carregarPrecontracts(),
        carregarContracts(),
      ]);

      setCarregando(false);
    }

    carregar();
  }, []);

  useEffect(() => {
    if (viewMode === 'Mês atual' && monthFilter !== 'all') {
      setMonthFilter('all');
    }
  }, [viewMode, monthFilter]);

  function handleFormChange(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: field === 'event_time' ? normalizeTimeStrict(value) : value,
    }));
  }

  async function carregarPrecontracts() {
    try {
      const { data, error } = await supabase
        .from('precontracts')
        .select('*');

      if (error) throw error;
      setPrecontracts((data || []).map((item) => sanitizeTimeFields(item)));
    } catch (error) {
      console.error('Erro ao carregar precontracts:', error);
    }
  }

  async function carregarContracts() {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('*');

      if (error) throw error;
      setContracts((data || []).map((item) => sanitizeTimeFields(item)));
    } catch (error) {
      console.error('Erro ao carregar contracts:', error);
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

    setForm((prev) => ({
      ...prev,
      formation: nextFormation,
      reception_hours: String(nextReceptionHours),
      has_sound: !!nextHasSound,
      formation_price: String(formationPrice || ''),
      reception_price: String(receptionPrice || ''),
      sound_price: String(soundPrice || ''),
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
    setEventoEscala(evento);
    setEscalaAberta(true);
    document.body.style.overflow = 'hidden';
  }

  function fecharEscala() {
    setEscalaAberta(false);
    setEventoEscala(null);
    document.body.style.overflow = '';
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
    const totalCosts = musicianCost + soundCost + extraTransportCost;

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
  }, [form, pricing]);

  async function salvarPricing() {
    if (!pricingId) {
      alert('Erro: Configuração de preços não carregada.');
      return;
    }

    try {
      setSalvando(true);

      const payload = {
        ...pricing,
        slug: 'default',
      };

      const { error } = await supabase
        .from('pricing_settings')
        .update(payload)
        .eq('id', pricingId);

      if (error) throw error;

      alert('Configuração de preços salva com sucesso.');
    } catch (error) {
      console.error('Erro ao salvar pricing:', error);
      alert('Erro ao salvar configuração de preços. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarEvento() {
    if (!form.client_name.trim()) {
      alert('Informe o contratante / cliente.');
      return;
    }

    if (!form.event_date) {
      alert('Informe a data do evento.');
      return;
    }

    if (!form.event_time) {
      alert('Informe a hora do evento.');
      return;
    }

    if (!isValidTime(form.event_time)) {
      alert('Informe um horário válido no formato HH:mm.');
      return;
    }

    if (!form.location_name.trim()) {
      alert('Informe o local do evento.');
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
        profit_amount: financial.profitAmount,

        status: form.status || 'Rascunho',
      };

      if (editandoId) {
        const { error } = await supabase
          .from('events')
          .update(payload)
          .eq('id', editandoId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('events').insert([payload]);

        if (error) throw error;
      }

      cancelarEdicao();
      await carregarEventos();
      setMobileTab('lista');
    } catch (error) {
      console.error('Erro ao salvar evento:', error);
      alert('Erro ao salvar evento. Tente novamente.');
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

  async function excluirEvento(id) {
    if (!confirm('Tem certeza que deseja excluir este evento?')) return;

    try {
      const { error } = await supabase.from('events').delete().eq('id', id);

      if (error) throw error;

      if (editandoId === id) {
        cancelarEdicao();
      }

      await carregarEventos();
    } catch (error) {
      console.error('Erro ao excluir evento:', error);
      alert('Erro ao excluir evento. Tente novamente.');
    }
  }

  async function confirmarRapido(evento) {
    const { error } = await supabase
      .from('events')
      .update({ status: 'Confirmado' })
      .eq('id', evento.id);

    if (error) {
      alert('Não foi possível confirmar o evento.');
      return;
    }

    setEventos((prev) =>
      prev.map((item) =>
        item.id === evento.id ? { ...item, status: 'Confirmado' } : item
      )
    );
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
        link: pre.public_token ? `/contrato/${pre.public_token}` : '',
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
          title="Eventos"
          subtitle="Pesquise, filtre e acompanhe sua operação."
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

          <Select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
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

        <div className="space-y-4">
          {eventosFiltrados.length === 0 ? (
            <div className="rounded-[20px] bg-[#f8fafc] px-4 py-5 text-[14px] font-semibold text-[#64748b]">
              Nenhum evento encontrado.
            </div>
          ) : (
            eventosFiltrados.map((ev) => {
              const timeline = getTimelineLabel(ev.event_date);
              const contractInfo = contractsByEventId.get(String(ev.id));

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
  contractLabel={contractInfo?.label || 'Sem contrato'}
  contractTone={contractInfo?.tone || 'default'}
  contractLink={contractInfo?.link || ''}
  onEdit={() => iniciarEdicao(ev)}
  onDelete={() => excluirEvento(ev.id)}
  onOpenEscala={() => abrirEscala(ev)}
  onOpenContract={() => abrirContratoRapido(ev)}
  onCopyContractLink={() => copiarLinkContrato(ev)}
  gerandoContrato={gerandoContratoId === ev.id}
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
            active={mobileTab}
            onChange={setMobileTab}
          />
        </div>

        <div className="space-y-5 md:hidden">
          {mobileTab === 'resumo' && (
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

          {mobileTab === 'evento' && (
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
            />
          )}

          {mobileTab === 'lista' && renderLista()}

          {mobileTab === 'precos' && (
            <EventosPricingTab
              pricing={pricing}
              setPricing={setPricing}
              salvarPricing={salvarPricing}
              salvando={salvando}
            />
          )}
        </div>
      </div>

      {escalaAberta && eventoEscala ? (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-[2px]">
          <div className="flex min-h-screen items-stretch justify-center md:p-6">
            <div className="flex min-h-screen w-full flex-col overflow-hidden bg-white md:min-h-0 md:max-h-[92vh] md:max-w-4xl md:rounded-[28px] md:border md:border-[#dbe3ef] md:shadow-[0_25px_60px_rgba(15,23,42,0.18)]">
              <div className="sticky top-0 z-10 border-b border-[#e6ebf2] bg-white px-5 py-4 md:px-6 md:py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-[32px] font-black tracking-[-0.04em] text-[#0f172a]">
                      Escala
                    </h2>

                    <div className="mt-2 text-[15px] font-semibold leading-7 text-[#64748b] md:text-[16px]">
                      {formatDateBR(eventoEscala.event_date)} • {String(eventoEscala.event_time || '-').slice(0, 5)} • {eventoEscala.client_name || 'Evento'}
                      {eventoEscala.location_name ? ` • ${eventoEscala.location_name}` : ''}
                    </div>

                    <div className="mt-2 text-[15px] font-semibold leading-7 text-[#64748b] md:text-[16px]">
                      {eventoEscala.formation || 'Sem formação definida'}
                      {eventoEscala.instruments ? ` — ${eventoEscala.instruments}` : ''}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={fecharEscala}
                    className="shrink-0 rounded-[18px] bg-[#f1f5f9] px-5 py-3 text-[15px] font-black text-[#0f172a]"
                  >
                    Fechar
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6 md:py-6">
                <EventoEscalaTab eventId={eventoEscala.id} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
