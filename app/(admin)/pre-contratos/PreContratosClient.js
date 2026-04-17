'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/components/ui/ToastProvider';
import { supabase } from '@/lib/supabase';
import { normalizeTimeStrict, isValidTime, sanitizeTimeFields } from '@/lib/time/normalize-time';

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

const STATUS_OPTIONS = [
  'draft',
  'link_generated',
  'client_filling',
  'signed',
  'cancelled',
];
const ADJUSTMENT_REQUEST_MARKER = '--- SOLICITAÇÃO DE AJUSTE DO CLIENTE ---';
const IS_DEV = process.env.NODE_ENV !== 'production';
const ADMIN_LIST_LIMIT = 120;
const PRECONTRACT_SELECT_FIELDS = [
  'id',
  'created_at',
  'client_name',
  'client_email',
  'client_phone',
  'event_type',
  'event_date',
  'event_time',
  'duration_min',
  'location_name',
  'location_address',
  'formation',
  'instruments',
  'has_sound',
  'reception_hours',
  'has_transport',
  'base_amount',
  'add_reception',
  'add_sound',
  'add_transport',
  'agreed_amount',
  'notes',
  'status',
  'public_token',
  'generated_link',
].join(', ');

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;

  const cleaned = String(value)
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatPhoneDisplay(value) {
  const cleaned = cleanPhone(value);
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return value || '-';
}

function formatDateBR(value) {
  if (!value) return '-';
  const [y, m, d] = String(value).split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function normalizeFormation(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return '';
  if (s.startsWith('solo')) return 'Solo';
  if (s.startsWith('duo')) return 'Duo';
  if (s.startsWith('trio')) return 'Trio';
  if (s.startsWith('quart')) return 'Quarteto';
  if (s.startsWith('quint')) return 'Quinteto';
  if (s.startsWith('sext')) return 'Sexteto';
  if (s.startsWith('sept')) return 'Septeto';
  return value;
}

function getStatusLabel(status) {
  const value = String(status || '').trim().toLowerCase();

  if (value === 'draft') return 'Rascunho';
  if (value === 'link_generated') return 'Link gerado';
  if (value === 'client_filling') return 'Cliente preenchendo';
  if (value === 'signed') return 'Assinado';
  if (value === 'cancelled') return 'Cancelado';

  return status || 'Rascunho';
}

function getStatusTone(status) {
  const value = String(status || '').trim().toLowerCase();

  if (value === 'signed') return 'emerald';
  if (value === 'client_filling') return 'blue';
  if (value === 'link_generated') return 'purple';
  if (value === 'cancelled') return 'red';

  return 'default';
}

function getInitialForm() {
  return {
    client_name: '',
    client_email: '',
    client_phone: '',

    event_type: '',
    event_date: '',
    event_time: '',
    duration_min: '60',

    location_name: '',
    location_address: '',

    formation: '',
    instruments: '',

    has_sound: false,
    reception_hours: '0',
    has_transport: false,

    base_amount: '',
    add_reception: '',
    add_sound: '',
    add_transport: '',
    agreed_amount: '',

    notes: '',
    status: 'draft',
  };
}

function extractLatestAdjustmentRequest(notes) {
  const rawNotes = String(notes || '');
  if (!rawNotes.trim()) return '';

  const upperNotes = rawNotes.toUpperCase();
  const markerIndex = upperNotes.lastIndexOf(ADJUSTMENT_REQUEST_MARKER.toUpperCase());
  if (markerIndex === -1) return '';

  const afterMarker = rawNotes.slice(markerIndex + ADJUSTMENT_REQUEST_MARKER.length);
  return afterMarker
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function AlertCard({ tone = 'default', title, children }) {
  const tones = {
    default: 'border-slate-200 bg-slate-50 text-slate-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    red: 'border-red-200 bg-red-50 text-red-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone] || tones.default}`}>
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function generateToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function buildContractLink(token) {
  if (typeof window === 'undefined') return `/contrato/${token}`;
  return `${window.location.origin}/contrato/${token}`;
}

function buildClientPanelLink(token) {
  if (typeof window === 'undefined') return `/cliente/${token}`;
  return `${window.location.origin}/cliente/${token}`;
}

function buildWhatsAppMessage({ clientName, contractLink }) {
  const saudacao = clientName?.trim()
    ? `Olá, ${clientName.trim()}!`
    : 'Olá!';

  return `${saudacao}

Segue o link do seu contrato:
${contractLink}

Peço que você preencha os dados com atenção, leia tudo no preview antes de assinar e finalize a assinatura com calma.

Depois de assinar, você poderá:
• baixar o PDF do contrato assinado
• acessar o painel do cliente
• acompanhar sua experiência completa conosco

Qualquer dúvida, me chama por aqui.`;
}

function buildWhatsAppUrl(phone, message) {
  const text = encodeURIComponent(message || '');
  const digits = cleanPhone(phone);

  if (digits) {
    return `https://api.whatsapp.com/send?phone=${digits}&text=${text}`;
  }

  return `https://api.whatsapp.com/send?text=${text}`;
}

function devLog(message, payload) {
  if (!IS_DEV) return;
  if (payload === undefined) {
    console.info(message);
    return;
  }
  console.info(message, payload);
}

function ShareLinkModal({
  open,
  onClose,
  data,
  onToast,
}) {
  if (!open || !data) return null;

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose?.();
  }

  return (
    <div
      className="fixed inset-0 z-[180] bg-black/70 backdrop-blur-[4px]"
      onClick={handleBackdropClick}
    >
      <div className="flex h-[100dvh] items-end justify-center overflow-hidden px-0 md:items-center md:px-6">
        <div
          className="flex h-[86dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-white text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:h-auto md:max-h-[88vh] md:rounded-[28px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 border-b border-slate-200 px-5 py-4">
            <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-slate-200 md:hidden" />
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[12px] font-black uppercase tracking-[0.12em] text-violet-600/80">
                  Link pronto para envio
                </div>
                <div className="mt-1 text-[22px] font-black tracking-[-0.03em]">
                  Pré-contrato salvo com sucesso
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Agora você já pode enviar tudo ao cliente sem sair desse fluxo.
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-[14px] border border-slate-200 bg-white px-4 py-2 text-[13px] font-extrabold text-slate-700"
              >
                Fechar
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="space-y-5">
              <div className="rounded-[24px] border border-violet-200 bg-violet-50 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.1em] text-violet-700/70">
                  Resumo do envio
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-[18px] border border-violet-200 bg-white px-4 py-3">
                    <div className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400">
                      Cliente
                    </div>
                    <div className="mt-1 text-[15px] font-bold text-slate-900">
                      {data.clientName || 'Cliente a confirmar'}
                    </div>
                  </div>

                  <div className="rounded-[18px] border border-violet-200 bg-white px-4 py-3">
                    <div className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400">
                      WhatsApp
                    </div>
                    <div className="mt-1 text-[15px] font-bold text-slate-900">
                      {formatPhoneDisplay(data.clientPhone)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">
                  Link do contrato
                </div>
                <div className="mt-2 break-all rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-[14px] font-semibold text-slate-800">
                  {data.contractLink}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">
                  Painel do cliente
                </div>
                <div className="mt-2 break-all rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-[14px] font-semibold text-slate-800">
                  {data.clientPanelLink}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">
                  Mensagem pronta
                </div>
                <div className="mt-2 whitespace-pre-wrap rounded-[18px] border border-slate-200 bg-white px-4 py-4 text-[14px] leading-6 text-slate-700">
                  {data.message}
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 px-5 py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <a
                href={data.whatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex"
              >
                <Button className="w-full">Abrir WhatsApp</Button>
              </a>

              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(data.message);
                    onToast?.('Mensagem copiada com sucesso.', 'success');
                  } catch (error) {
                    console.error(error);
                    onToast?.('Não foi possível copiar a mensagem.', 'error');
                  }
                }}
              >
                Copiar mensagem
              </Button>

              <Button
                variant="soft"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(data.contractLink);
                    onToast?.('Link copiado com sucesso.', 'success');
                  } catch (error) {
                    console.error(error);
                    onToast?.('Não foi possível copiar o link.', 'error');
                  }
                }}
              >
                Copiar link
              </Button>

              <a
                href={data.clientPanelLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex"
              >
                <Button variant="soft" className="w-full">
                  Abrir painel do cliente
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-3xl border border-slate-200 bg-white p-5">
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-64 rounded bg-slate-100" />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="h-16 rounded-2xl bg-slate-100" />
            <div className="h-16 rounded-2xl bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PreviewContractModal({ open, item, onClose }) {
  if (!open || !item) return null;

  const adjustmentMessage = extractLatestAdjustmentRequest(item.notes);

  return (
    <div className="fixed inset-0 z-[190] bg-slate-950/70 px-4 py-6 backdrop-blur-[3px]" onClick={onClose}>
      <div
        className="mx-auto max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[30px] border border-white/15 bg-white p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.1em] text-violet-600">Visualização premium</p>
            <h3 className="mt-1 text-2xl font-black text-slate-900">Contrato de {item.client_name || 'Cliente'}</h3>
          </div>
          <Button variant="soft" onClick={onClose}>Fechar</Button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card title="Dados do cliente">
            <p><strong>Nome:</strong> {item.client_name || '-'}</p>
            <p className="mt-1"><strong>WhatsApp:</strong> {formatPhoneDisplay(item.client_phone)}</p>
            <p className="mt-1"><strong>Email:</strong> {item.client_email || '-'}</p>
          </Card>
          <Card title="Dados do evento">
            <p><strong>Data:</strong> {formatDateBR(item.event_date)}</p>
            <p className="mt-1"><strong>Hora:</strong> {item.event_time ? String(item.event_time).slice(0, 5) : '--:--'}</p>
            <p className="mt-1"><strong>Local:</strong> {item.location_name || '-'}</p>
            <p className="mt-1"><strong>Formação:</strong> {item.formation || '-'}</p>
            <p className="mt-1"><strong>Valor acertado:</strong> {formatMoney(item.agreed_amount)}</p>
          </Card>
        </div>

        <Card title="Observações" className="mt-4">
          <p className="whitespace-pre-wrap text-sm text-slate-700">{item.notes || 'Sem observações.'}</p>
        </Card>

        {adjustmentMessage ? (
          <Card title="Solicitação de ajuste" className="mt-4">
            <p className="whitespace-pre-wrap text-sm text-amber-800">{adjustmentMessage}</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

export default function PreContratosClient() {
  const searchParams = useSearchParams();
  const { showToast } = useToast() || {};
  const [items, setItems] = useState([]);
  const [eventos, setEventos] = useState([]);

  const [editandoId, setEditandoId] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');
  const [copiadoId, setCopiadoId] = useState(null);
  const [gerandoLinkId, setGerandoLinkId] = useState(null);
  const [ultimoAutoEditId, setUltimoAutoEditId] = useState(null);
  const [adjustmentHighlight, setAdjustmentHighlight] = useState({
    active: false,
    message: '',
  });
  const [adjustmentRequestsByPrecontract, setAdjustmentRequestsByPrecontract] = useState(new Map());

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareData, setShareData] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);

  const [form, setForm] = useState(getInitialForm());

async function carregarPreContratos() {
    const { data, error } = await supabase
      .from('precontracts')
      .select(PRECONTRACT_SELECT_FIELDS)
      .order('created_at', { ascending: false })
      .limit(ADMIN_LIST_LIMIT);

    if (error) throw error;
    const sanitizedItems = (data || []).map((item) => sanitizeTimeFields(item));
    setItems(sanitizedItems);
    return sanitizedItems;
  }

  async function carregarAdjustmentRequests(precontracts = []) {
    const precontractIds = (precontracts || [])
      .map((item) => item?.id)
      .filter((id) => id !== null && id !== undefined);

    if (precontractIds.length === 0) {
      setAdjustmentRequestsByPrecontract(new Map());
      return;
    }

    const { data, error } = await supabase
  .from('contract_adjustment_requests')
  .select('id, precontract_id, status, request_message, created_at, resolved_at')
  .in('precontract_id', precontractIds)
  .order('created_at', { ascending: false });

    if (error) {
      console.warn('[PRECONTRATOS] contract_adjustment_requests indisponível:', error);
      setAdjustmentRequestsByPrecontract(new Map());
      return;
    }

    const nextMap = new Map();
    for (const row of data || []) {
      const key = String(row?.precontract_id || '');
      if (!key || nextMap.has(key)) continue;
      nextMap.set(key, row);
    }
    setAdjustmentRequestsByPrecontract(nextMap);
  }

  async function carregarEventos() {
    const { data, error } = await supabase
      .from('events')
      .select('id, client_name, event_date, event_time, location_name, status')
      .order('event_date', { ascending: true });

    if (error) throw error;
    setEventos(
      (data || []).map((item) => sanitizeTimeFields(item))
    );
  }

  useEffect(() => {
    async function carregar() {
      try {
        setCarregando(true);
        const [loadedPrecontracts] = await Promise.all([carregarPreContratos(), carregarEventos()]);
        carregarAdjustmentRequests(loadedPrecontracts);
      } catch (error) {
        console.error('Erro ao carregar pré-contratos:', error);
        showToast?.(`Erro ao carregar pré-contratos: ${error?.message || 'erro desconhecido'}`, 'error');
      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, [showToast]);

  function handleFormChange(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: field === 'event_time' ? normalizeTimeStrict(value) : value,
    }));
  }

  function resetForm() {
    setEditandoId(null);
    setAdjustmentHighlight({ active: false, message: '' });
    setForm(getInitialForm());
  }

  function iniciarEdicao(item, options = {}) {
    setEditandoId(item.id);
    const adjustmentMessage = extractLatestAdjustmentRequest(item.notes);
    setAdjustmentHighlight({
      active: Boolean(options?.highlight),
      message: adjustmentMessage,
    });

    setForm({
      client_name: item.client_name || '',
      client_email: item.client_email || '',
      client_phone: item.client_phone || '',

      event_type: item.event_type || '',
      event_date: item.event_date || '',
      event_time: normalizeTimeStrict(item.event_time || ''),
      duration_min: String(item.duration_min ?? 60),

      location_name: item.location_name || '',
      location_address: item.location_address || '',

      formation: item.formation || '',
      instruments: item.instruments || '',

      has_sound: !!item.has_sound,
      reception_hours: String(item.reception_hours ?? 0),
      has_transport: !!item.has_transport,

      base_amount: String(item.base_amount ?? ''),
      add_reception: String(item.add_reception ?? ''),
      add_sound: String(item.add_sound ?? ''),
      add_transport: String(item.add_transport ?? ''),
      agreed_amount: String(item.agreed_amount ?? ''),

      notes: item.notes || '',
      status: item.status || 'draft',
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  useEffect(() => {
    const editParam = searchParams.get('edit') || searchParams.get('id');
    if (!editParam || !items.length) return;

    if (ultimoAutoEditId === editParam) return;

    const item = items.find((entry) => String(entry.id) === String(editParam));
    if (!item) return;

    const shouldHighlight = searchParams.get('highlightAdjustment') === '1';
    iniciarEdicao(item, { highlight: shouldHighlight });
    setUltimoAutoEditId(String(editParam));
  }, [searchParams, items, ultimoAutoEditId]);

  const financeiro = useMemo(() => {
    const base = toNumber(form.base_amount);
    const addReception = toNumber(form.add_reception);
    const addSound = toNumber(form.add_sound);
    const addTransport = toNumber(form.add_transport);

    const calculado = base + addReception + addSound + addTransport;
    const agreed = form.agreed_amount === '' ? calculado : toNumber(form.agreed_amount);

    return {
      base,
      addReception,
      addSound,
      addTransport,
      calculado,
      agreed,
    };
  }, [form]);

  const conflitos = useMemo(() => {
    if (!form.event_date) return [];

    const dataSelecionada = form.event_date;
    const horaSelecionada = normalizeTimeStrict(form.event_time) || null;

    return eventos.filter((ev) => {
      if (!ev.event_date) return false;
      if (ev.event_date !== dataSelecionada) return false;

      if (!horaSelecionada || !ev.event_time) return true;

      const [h1, m1] = String(horaSelecionada).slice(0, 5).split(':').map(Number);
      const [h2, m2] = normalizeTimeStrict(ev.event_time).split(':').map(Number);

      const minutos1 = h1 * 60 + m1;
      const minutos2 = h2 * 60 + m2;

      return Math.abs(minutos1 - minutos2) <= 180;
    });
  }, [form.event_date, form.event_time, eventos]);

  function openShareModalFromItem(item) {
    const token = item.public_token;
    if (!token) return;

    const contractLink = item.generated_link || buildContractLink(token);
    const clientPanelLink = buildClientPanelLink(token);
    const message = buildWhatsAppMessage({
      clientName: item.client_name,
      contractLink,
      clientPanelLink,
    });

    setShareData({
      clientName: item.client_name || '',
      clientPhone: item.client_phone || '',
      contractLink,
      clientPanelLink,
      message,
      whatsAppUrl: buildWhatsAppUrl(item.client_phone, message),
    });
    setShareModalOpen(true);
  }

  async function salvarPreContrato() {
    if (salvando) return;

    if (!form.event_date) {
      showToast?.('Informe a data do evento.', 'warning');
      return;
    }

    if (form.event_time && !isValidTime(form.event_time)) {
      showToast?.('Informe um horário válido no formato HH:mm.', 'warning');
      return;
    }

    let savedItemForShare = null;

    try {
      setSalvando(true);

      const token = editandoId ? null : generateToken();
      const finalToken = token || undefined;

      const statusBase = form.status || 'draft';
      const statusToSave =
        statusBase === 'signed' || statusBase === 'cancelled'
          ? statusBase
          : 'link_generated';

      const generatedLink = editandoId
        ? null
        : buildContractLink(finalToken);

      console.log('[TIME AUDIT]', {
        flow: 'pre-contrato',
        original: form.event_time,
        normalized: normalizeTimeStrict(form.event_time),
      });

      const payload = {
        client_name: form.client_name.trim() || null,
        client_email: form.client_email.trim() || null,
        client_phone: cleanPhone(form.client_phone) || null,

        event_type: form.event_type || null,
        event_date: form.event_date || null,
        event_time: normalizeTimeStrict(form.event_time) || null,
        duration_min: parseInt(form.duration_min, 10) || 60,

        location_name: form.location_name.trim() || null,
        location_address: form.location_address.trim() || null,

        formation: normalizeFormation(form.formation),
        instruments: form.instruments.trim() || null,

        has_sound: !!form.has_sound,
        reception_hours: parseInt(form.reception_hours, 10) || 0,
        has_transport: !!form.has_transport,

        base_amount: financeiro.base,
        add_reception: financeiro.addReception,
        add_sound: financeiro.addSound,
        add_transport: financeiro.addTransport,
        agreed_amount: financeiro.agreed,

        notes: form.notes.trim() || null,
        status: statusToSave,
      };

      let savedItem = null;

      if (editandoId) {
        const existingItem = items.find((entry) => String(entry.id) === String(editandoId));
        const tokenFinal = existingItem?.public_token || generateToken();
        const linkFinal = existingItem?.generated_link || buildContractLink(tokenFinal);

        const { data, error } = await supabase
          .from('precontracts')
          .update({
            ...payload,
            public_token: tokenFinal,
            generated_link: linkFinal,
          })
          .eq('id', editandoId)
          .select(PRECONTRACT_SELECT_FIELDS)
          .single();

        if (error) throw error;
        savedItem = sanitizeTimeFields(data);
      } else {
        const { data, error } = await supabase
          .from('precontracts')
          .insert([
            {
              ...payload,
              public_token: finalToken,
              generated_link: generatedLink,
            },
          ])
          .select(PRECONTRACT_SELECT_FIELDS)
          .single();

        if (error) throw error;
        savedItem = sanitizeTimeFields(data);
      }

      setItems((prev) => {
        const next = [savedItem, ...prev.filter((entry) => entry.id !== savedItem.id)];
        return next.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      });
      console.info('[PRECONTRATOS] salvo com sucesso', {
        id: savedItem?.id,
        mode: editandoId ? 'update' : 'insert',
        public_token: savedItem?.public_token || '(vazio)',
      });
      showToast?.('Pré-contrato salvo com sucesso.', 'success');
      savedItemForShare = savedItem;
      resetForm();
    } catch (error) {
      console.error('Erro ao salvar pré-contrato:', error);
      showToast?.(`Erro ao salvar pré-contrato: ${error?.message || 'erro desconhecido'}`, 'error');
    } finally {
      setSalvando(false);
    }

    if (savedItemForShare?.public_token) {
      setTimeout(() => {
        openShareModalFromItem(savedItemForShare);
      }, 0);
    }
  }

  async function confirmarAjusteRealizado() {
    if (!editandoId) return;

    const pending = adjustmentRequestsByPrecontract.get(String(editandoId));
    if (!pending || String(pending.status || '').toLowerCase() !== 'pending') {
      showToast?.('Nenhuma solicitação pendente para este pré-contrato.', 'warning');
      return;
    }

    try {
      setSalvando(true);

      const { error: resolveError } = await supabase
        .from('contract_adjustment_requests')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_note: 'Ajuste aplicado no pré-contrato pelo admin.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', pending.id);

      if (resolveError) throw resolveError;

      const { error: precontractStatusError } = await supabase
        .from('precontracts')
        .update({
          status: 'link_generated',
        })
        .eq('id', editandoId);

      if (precontractStatusError) throw precontractStatusError;

      await Promise.all([carregarPreContratos(), carregarAdjustmentRequests()]);

      const shouldCreateNew = window.confirm(
        'Ajuste confirmado com sucesso. Deseja registrar um novo ajuste?'
      );
      if (shouldCreateNew) {
        handleFormChange('adjustment_request', '');
      }

      showToast?.('Ajuste marcado como resolvido. A assinatura foi liberada novamente.', 'success');
    } catch (error) {
      console.error('Erro ao confirmar ajuste:', error);
      showToast?.(`Não foi possível confirmar o ajuste: ${error?.message || 'erro desconhecido'}`, 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function excluirPreContrato(id) {
    if (!confirm('Excluir este pré-contrato?')) return;

    try {
      const { error } = await supabase
        .from('precontracts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (editandoId === id) {
        resetForm();
      }

      await carregarPreContratos();
    } catch (error) {
      console.error('Erro ao excluir pré-contrato:', error);
      showToast?.('Erro ao excluir pré-contrato.', 'error');
    }
  }

  async function copiarLink(link, id) {
    try {
      await navigator.clipboard.writeText(link);
      setCopiadoId(id);
      setTimeout(() => setCopiadoId(null), 1800);
    } catch (error) {
      console.error('Erro ao copiar link:', error);
      showToast?.('Não foi possível copiar o link.', 'error');
    }
  }

  async function gerarLinkContrato(item) {
    try {
      setGerandoLinkId(item.id);

      const token = item.public_token || generateToken();
      const link = buildContractLink(token);
      devLog('[CONTRACT_TOKEN_FLOW] token gerado para link', {
        precontractId: item.id,
        token_gerado: token,
      });

      const { data, error } = await supabase
        .from('precontracts')
        .update({
          public_token: token,
          generated_link: link,
          status: item.status === 'signed' ? 'signed' : 'link_generated',
        })
        .eq('id', item.id)
        .select(PRECONTRACT_SELECT_FIELDS)
        .single();

      if (error) throw error;

      setItems((prev) => {
        const current = sanitizeTimeFields(data);
        return [current, ...prev.filter((entry) => entry.id !== current.id)];
      });
      devLog('[CONTRACT_TOKEN_FLOW] token salvo após gerar link', {
        precontractId: item.id,
        public_token: data?.public_token || token,
        generated_link: data?.generated_link || link,
      });
      showToast?.('Link do contrato gerado com sucesso.', 'success');
      await copiarLink(link, item.id);

      if (data) {
        openShareModalFromItem(data);
      }
    } catch (error) {
      console.error('Erro ao gerar link do contrato:', error);
      showToast?.(`Erro ao gerar link: ${error?.message || 'erro desconhecido'}`, 'error');
    } finally {
      setGerandoLinkId(null);
    }
  }

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    if (!termo) return items;

    return items.filter((item) =>
      [
        item.client_name,
        item.client_email,
        item.client_phone,
        item.location_name,
        item.formation,
        item.event_type,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(termo))
    );
  }, [items, busca]);

  const pendingAdjustment = editandoId
    ? adjustmentRequestsByPrecontract.get(String(editandoId)) || null
    : null;

  if (carregando) {
    return (
      <AdminShell pageTitle="Pré-contratos" activeItem="contratos">
        <Card>
          <LoadingSkeleton />
        </Card>
      </AdminShell>
    );
  }

  return (
    <AdminShell pageTitle="Pré-contratos" activeItem="contratos">
      <div className="space-y-6">
        <Card
          title={editandoId ? 'Editar pré-contrato' : 'Novo pré-contrato'}
          subtitle="Etapa comercial inicial antes do contrato e da criação operacional do evento."
        >
          {editandoId && adjustmentHighlight.message ? (
            <div className="mb-5">
              <AlertCard tone={adjustmentHighlight.active ? 'amber' : 'default'} title="Solicitação de ajuste do cliente">
                {adjustmentHighlight.message}
              </AlertCard>
            </div>
          ) : null}
          {editandoId && pendingAdjustment && String(pendingAdjustment.status || '').toLowerCase() === 'pending' ? (
            <div className="mb-5">
              <AlertCard tone="amber" title="Ajuste pendente (bloqueia assinatura)">
                <p>{pendingAdjustment.request_message}</p>
                <p className="mt-1 text-xs opacity-80">
                  Solicitado em {new Date(pendingAdjustment.created_at).toLocaleString('pt-BR')}
                </p>
              </AlertCard>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <Card title="Cliente">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Input
                    label="Nome de referência (opcional)"
                    value={form.client_name}
                    onChange={(e) => handleFormChange('client_name', e.target.value)}
                    placeholder="Pode deixar em branco e deixar o cliente preencher depois"
                  />

                  <Input
                    label="WhatsApp de referência"
                    value={form.client_phone}
                    onChange={(e) => handleFormChange('client_phone', e.target.value)}
                  />

                  <Input
                    label="Email de referência"
                    value={form.client_email}
                    onChange={(e) => handleFormChange('client_email', e.target.value)}
                    className="md:col-span-2"
                  />
                </div>
              </Card>

              <Card title="Evento">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Select
                    label="Tipo de evento"
                    value={form.event_type}
                    onChange={(e) => handleFormChange('event_type', e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {EVENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>

                  <Select
                    label="Formação"
                    value={form.formation}
                    onChange={(e) => handleFormChange('formation', e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {FORMATIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </Select>

                  <Input
                    label="Data"
                    type="date"
                    value={form.event_date}
                    onChange={(e) => handleFormChange('event_date', e.target.value)}
                  />

                  <Input
                    label="Hora"
                    type="time"
                    step="60"
                    value={form.event_time}
                    onChange={(e) => handleFormChange('event_time', e.target.value)}
                  />

                  <Input
                    label="Duração (min)"
                    type="number"
                    min="1"
                    value={form.duration_min}
                    onChange={(e) => handleFormChange('duration_min', e.target.value)}
                  />

                  <Input
                    label="Instrumentos"
                    value={form.instruments}
                    onChange={(e) => handleFormChange('instruments', e.target.value)}
                  />

                  <Input
                    label="Local"
                    value={form.location_name}
                    onChange={(e) => handleFormChange('location_name', e.target.value)}
                  />

                  <Input
                    label="Endereço"
                    value={form.location_address}
                    onChange={(e) => handleFormChange('location_address', e.target.value)}
                  />
                </div>
              </Card>

              <Card title="Operação">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <label className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                    <span className="font-medium text-slate-700">Tem som</span>
                    <input
                      type="checkbox"
                      checked={form.has_sound}
                      onChange={(e) => handleFormChange('has_sound', e.target.checked)}
                      className="h-5 w-5"
                    />
                  </label>

                  <Input
                    label="Receptivo (h)"
                    type="number"
                    min="0"
                    max="6"
                    value={form.reception_hours}
                    onChange={(e) => handleFormChange('reception_hours', e.target.value)}
                  />

                  <label className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                    <span className="font-medium text-slate-700">Tem transporte</span>
                    <input
                      type="checkbox"
                      checked={form.has_transport}
                      onChange={(e) => handleFormChange('has_transport', e.target.checked)}
                      className="h-5 w-5"
                    />
                  </label>
                </div>
              </Card>

              <Card title="Financeiro">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Input
                    label="Valor base"
                    value={form.base_amount}
                    onChange={(e) => handleFormChange('base_amount', e.target.value)}
                  />

                  <Input
                    label="Adicional receptivo"
                    value={form.add_reception}
                    onChange={(e) => handleFormChange('add_reception', e.target.value)}
                  />

                  <Input
                    label="Adicional som"
                    value={form.add_sound}
                    onChange={(e) => handleFormChange('add_sound', e.target.value)}
                  />

                  <Input
                    label="Adicional transporte"
                    value={form.add_transport}
                    onChange={(e) => handleFormChange('add_transport', e.target.value)}
                  />

                  <Input
                    label="Valor acertado"
                    value={form.agreed_amount}
                    onChange={(e) => handleFormChange('agreed_amount', e.target.value)}
                    className="xl:col-span-2"
                  />

                  <Select
                    label="Status"
                    value={form.status}
                    onChange={(e) => handleFormChange('status', e.target.value)}
                    className="xl:col-span-2"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {getStatusLabel(status)}
                      </option>
                    ))}
                  </Select>
                </div>

                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-medium text-slate-600">
                    Observações
                  </span>
                  <textarea
                    value={form.notes}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                    className="min-h-[100px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                  />
                </label>
              </Card>
            </div>

            <div className="space-y-6">
              <Card title="Resumo financeiro">
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Base
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {formatMoney(financeiro.base)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Adicionais
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {formatMoney(
                        financeiro.addReception +
                          financeiro.addSound +
                          financeiro.addTransport
                      )}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                      Total calculado
                    </p>
                    <p className="mt-1 text-2xl font-bold text-violet-700">
                      {formatMoney(financeiro.calculado)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                      Valor acertado
                    </p>
                    <p className="mt-1 text-2xl font-bold text-emerald-700">
                      {formatMoney(financeiro.agreed)}
                    </p>
                  </div>
                </div>
              </Card>

              <Card title="Validação de agenda">
                {!form.event_date ? (
                  <AlertCard title="Aguardando data">
                    Informe a data do evento para verificar conflitos.
                  </AlertCard>
                ) : conflitos.length === 0 ? (
                  <AlertCard tone="emerald" title="Agenda livre">
                    Nenhum evento próximo encontrado para a data selecionada.
                  </AlertCard>
                ) : (
                  <div className="space-y-3">
                    <AlertCard tone="amber" title="Atenção">
                      Foram encontrados eventos no mesmo dia ou próximos do horário informado.
                    </AlertCard>

                    {conflitos.map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
                      >
                        <p className="text-sm font-semibold text-amber-900">
                          {ev.client_name || 'Evento sem cliente'}
                        </p>
                        <p className="mt-1 text-sm text-amber-800">
                          {formatDateBR(ev.event_date)} • {ev.event_time ? String(ev.event_time).slice(0, 5) : '--:--'}
                        </p>
                        <p className="mt-1 text-sm text-amber-700">
                          {ev.location_name || 'Local não informado'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Ações">
                <div className="flex flex-col gap-3">
                  <Button onClick={salvarPreContrato} disabled={salvando}>
                    {salvando
                      ? 'Salvando...'
                      : editandoId
                      ? 'Atualizar e abrir envio'
                      : 'Salvar e abrir envio'}
                  </Button>

                  {editandoId && (
                    <Button variant="soft" onClick={resetForm}>
                      Cancelar edição
                    </Button>
                  )}

                  {editandoId && pendingAdjustment && String(pendingAdjustment.status || '').toLowerCase() === 'pending' ? (
                    <Button variant="secondary" onClick={confirmarAjusteRealizado} disabled={salvando}>
                      Confirmar ajuste realizado
                    </Button>
                  ) : null}

                  <Button variant="secondary" disabled>
                    O link será aberto automaticamente após salvar
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </Card>

        <Card title="Pré-contratos cadastrados">
          <Input
            placeholder="Buscar por cliente, email, telefone, local..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="mb-4"
          />

          {listaFiltrada.length === 0 ? (
            <p className="text-slate-500">Nenhum pré-contrato encontrado.</p>
          ) : (
            <div className="space-y-4">
              {listaFiltrada.map((item) => {
                const adjustment = adjustmentRequestsByPrecontract.get(String(item.id)) || null;
                const pending = String(adjustment?.status || '').toLowerCase() === 'pending';
                return (
                <Card
                  key={item.id}
                  title={item.client_name || 'Cliente a confirmar'}
                  subtitle={`${formatDateBR(item.event_date)} • ${item.location_name || 'Local não informado'}`}
                  actions={
                    <Badge tone={getStatusTone(item.status)}>
                      {getStatusLabel(item.status)}
                    </Badge>
                  }
                >
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data</p>
                      <p className="mt-1 text-sm font-bold text-slate-800">{formatDateBR(item.event_date)}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Local</p>
                      <p className="mt-1 text-sm font-bold text-slate-800">{item.location_name || '-'}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Formação</p>
                      <p className="mt-1 text-sm font-bold text-slate-800">{item.formation || '-'}</p>
                    </div>
                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 xl:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Valor acertado</p>
                      <p className="mt-1 text-lg font-black text-emerald-700">{formatMoney(item.agreed_amount)}</p>
                    </div>
                    <div className="rounded-3xl border border-violet-200 bg-violet-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Extras</p>
                      <p className="mt-1 text-sm font-semibold text-violet-800">
                        Receptivo: {item.reception_hours ? `${item.reception_hours}h` : 'Não'} • Antesala: {item.has_ante_room ? 'Sim' : 'Não'}
                      </p>
                    </div>

                    {pending ? (
                      <div className="xl:col-span-3">
                        <AlertCard tone="amber" title="Ajuste pendente">
                          {adjustment.request_message}
                        </AlertCard>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setPreviewItem(item);
                        setPreviewOpen(true);
                      }}
                    >
                      Visualizar contrato
                    </Button>
                    <Button variant="soft" onClick={() => iniciarEdicao(item)}>
                      Editar
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => gerarLinkContrato(item)}
                      disabled={gerandoLinkId === item.id}
                    >
                      {gerandoLinkId === item.id ? 'Gerando...' : 'Abrir envio'}
                    </Button>

                    {item.generated_link && (
                      <Button
                        variant="soft"
                        onClick={() => copiarLink(item.generated_link, item.id)}
                      >
                        {copiadoId === item.id ? 'Copiado!' : 'Copiar link'}
                      </Button>
                    )}

                    <Button
                      variant="danger"
                      onClick={() => excluirPreContrato(item.id)}
                    >
                      Excluir
                    </Button>
                  </div>
                </Card>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <ShareLinkModal
        open={shareModalOpen}
        onClose={() => {
          setShareModalOpen(false);
          setShareData(null);
        }}
        data={shareData}
        onToast={(message, type) => showToast?.(message, type)}
      />
      <PreviewContractModal
        open={previewOpen}
        item={previewItem}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewItem(null);
        }}
      />
    </AdminShell>
  );
}
