'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminSummaryCard from '@/components/admin/AdminSummaryCard';

const EVENT_TYPES = [
  { value: 'invite_member', label: 'Convite enviado ao membro' },
  { value: 'contract_signed_client', label: 'Contrato assinado pelo cliente' },
  { value: 'repertoire_pending_15_days_client', label: 'Repertório pendente há 15 dias (cliente)' },
  { value: 'payment_pending_2_days_client', label: 'Pagamento pendente há 2 dias (cliente)' },
  { value: 'post_event_review_request_client', label: 'Solicitação de avaliação pós-evento (cliente)' },
  { value: 'schedule_fully_confirmed_admin', label: 'Escala totalmente confirmada (admin)' },
  { value: 'schedule_pending_15_days_admin', label: 'Escala pendente há 15 dias (admin)' },
];

const RECIPIENT_TYPES = [
  { value: 'client', label: 'Cliente' },
  { value: 'member', label: 'Membro' },
  { value: 'admin', label: 'Administrador' },
  { value: 'financial', label: 'Financeiro' },
];

const FORM_INICIAL = {
  name: '',
  key: '',
  event_type: '',
  recipient_type: '',
  template_id: '',
  channel_id: '',
  days_before: '',
  days_after: '',
  send_time: '',
  is_active: true,
};

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function StatusBadge({ isActive }) {
  return isActive ? (
    <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-700">
      Ativo
    </span>
  ) : (
    <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-bold text-gray-600">
      Inativo
    </span>
  );
}

function EventTypeBadge({ eventType }) {
  const found = EVENT_TYPES.find((e) => e.value === eventType);
  return (
    <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">
      {found ? found.label : eventType}
    </span>
  );
}

function RecipientBadge({ recipientType }) {
  const found = RECIPIENT_TYPES.find((r) => r.value === recipientType);
  return (
    <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-bold text-sky-700">
      {found ? found.label : recipientType}
    </span>
  );
}

function TimingLabel({ daysBefore, daysAfter, sendTime }) {
  const parts = [];
  if (daysBefore) parts.push(`${daysBefore} dias antes`);
  if (daysAfter) parts.push(`${daysAfter} dias depois`);
  if (sendTime) parts.push(`às ${sendTime}`);
  if (parts.length === 0) return <span className="text-[#94a3b8]">—</span>;
  return <span>{parts.join(' · ')}</span>;
}

export default function RegrasPageClient() {
  const [regras, setRegras] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [canais, setCanais] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);

  const carregarDados = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);

      const [resRegras, resTemplates, resCanais] = await Promise.all([
        fetch('/api/automation/rules'),
        fetch('/api/automation/templates'),
        fetch('/api/automation/channels'),
      ]);

      const [dataRegras, dataTemplates, dataCanais] = await Promise.all([
        resRegras.json(),
        resTemplates.json(),
        resCanais.json(),
      ]);

      if (!resRegras.ok) throw new Error(dataRegras.error || 'Erro ao carregar regras');

      setRegras(dataRegras.rules || []);
      setTemplates(dataTemplates.templates || []);
      setCanais(dataCanais.channels || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  function abrirModalNovo() {
    setEditandoId(null);
    setForm(FORM_INICIAL);
    setErroModal(null);
    setModalAberto(true);
  }

  function abrirModalEditar(regra) {
    setEditandoId(regra.id);
    setForm({
      name: regra.name || '',
      key: regra.key || '',
      event_type: regra.event_type || '',
      recipient_type: regra.recipient_type || '',
      template_id: regra.template_id || '',
      channel_id: regra.channel_id || '',
      days_before: regra.days_before ?? '',
      days_after: regra.days_after ?? '',
      send_time: regra.send_time || '',
      is_active: regra.is_active !== false,
    });
    setErroModal(null);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditandoId(null);
    setForm(FORM_INICIAL);
    setErroModal(null);
  }

  function handleNomeChange(e) {
    const novoNome = e.target.value;
    setForm((f) => ({
      ...f,
      name: novoNome,
      key: f.key === '' || f.key === slugify(f.name) ? slugify(novoNome) : f.key,
    }));
  }

  async function salvarRegra() {
    setErroModal(null);

    if (!form.name || !form.key || !form.event_type || !form.recipient_type) {
      setErroModal('Preencha todos os campos obrigatórios: Nome, Key, Tipo de Evento e Destinatário.');
      return;
    }

    try {
      setSalvando(true);

      const url = editandoId
        ? `/api/automation/rules/${editandoId}`
        : '/api/automation/rules';

      const method = editandoId ? 'PATCH' : 'POST';

      const payload = {
        name: form.name,
        key: form.key,
        event_type: form.event_type,
        recipient_type: form.recipient_type,
        template_id: form.template_id || null,
        channel_id: form.channel_id || null,
        days_before: form.days_before !== '' ? Number(form.days_before) : null,
        days_after: form.days_after !== '' ? Number(form.days_after) : null,
        send_time: form.send_time || null,
        is_active: form.is_active,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar regra');
      }

      await carregarDados();
      fecharModal();
    } catch (error) {
      console.error('Erro ao salvar regra:', error);
      setErroModal(error.message);
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAtivo(regraId, isActive) {
    try {
      const response = await fetch(`/api/automation/rules/${regraId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar status');
      }

      await carregarDados();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert(error.message);
    }
  }

  const total = regras.length;
  const ativas = regras.filter((r) => r.is_active).length;
  const inativas = total - ativas;

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">
              Automação
            </div>
            <h1 className="mt-1 text-[28px] font-black tracking-[-0.03em] text-[#0f172a]">
              Regras de Automação
            </h1>
            <p className="mt-2 max-w-3xl text-[15px] leading-7 text-[#64748b]">
              Defina quando, para quem e por qual canal cada automação do sistema deve ser executada.
            </p>
          </div>
          <div className="shrink-0">
            <button
              onClick={abrirModalNovo}
              className="rounded-full bg-violet-600 px-5 py-2.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-95"
            >
              + Nova Regra
            </button>
          </div>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-3 gap-4">
        <AdminSummaryCard label="Total" value={carregando ? '–' : total} tone="default" />
        <AdminSummaryCard label="Ativas" value={carregando ? '–' : ativas} tone="success" />
        <AdminSummaryCard label="Inativas" value={carregando ? '–' : inativas} tone="warning" />
      </section>

      {/* Loading */}
      {carregando && (
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-12 text-center shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <div className="mx-auto flex max-w-xs flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
            <p className="text-[14px] font-semibold text-[#64748b]">Carregando regras...</p>
          </div>
        </section>
      )}

      {/* Error */}
      {!carregando && erro && (
        <section className="rounded-[28px] border border-red-200 bg-red-50 p-8 text-center shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <div className="mb-2 text-[32px]">⚠️</div>
          <p className="text-[15px] font-bold text-red-700">{erro}</p>
          <button
            onClick={carregarDados}
            className="mt-4 rounded-full border border-red-300 px-5 py-2 text-[13px] font-bold text-red-700 transition hover:bg-red-100"
          >
            Tentar novamente
          </button>
        </section>
      )}

      {/* Empty State */}
      {!carregando && !erro && regras.length === 0 && (
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-12 text-center shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <div className="mx-auto max-w-md">
            <div className="mb-4 text-[48px]">⚙️</div>
            <h2 className="text-[20px] font-black tracking-[-0.02em] text-[#0f172a]">
              Nenhuma regra cadastrada
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-[#64748b]">
              Crie sua primeira regra de automação para definir quando e para quem as mensagens serão enviadas.
            </p>
            <div className="mt-6 flex justify-center">
              <button
                onClick={abrirModalNovo}
                className="rounded-full bg-violet-600 px-5 py-2.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-violet-700"
              >
                Criar primeira regra
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Rules List */}
      {!carregando && !erro && regras.length > 0 && (
        <section className="space-y-4">
          {regras.map((regra) => (
            <div
              key={regra.id}
              className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  {/* Name + status */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-black tracking-[-0.02em] text-[#0f172a]">
                      {regra.name}
                    </span>
                    <StatusBadge isActive={regra.is_active} />
                  </div>

                  {/* Key */}
                  <div className="mt-1">
                    <code className="rounded bg-[#f1f5f9] px-1.5 py-0.5 text-[12px] font-bold text-[#475569]">
                      {regra.key}
                    </code>
                  </div>

                  {/* Badges */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <EventTypeBadge eventType={regra.event_type} />
                    <RecipientBadge recipientType={regra.recipient_type} />
                  </div>

                  {/* Details */}
                  <div className="mt-2 space-y-0.5 text-[13px] text-[#64748b]">
                    <div>
                      <span className="font-semibold">Template:</span>{' '}
                      {regra.message_templates?.name || (
                        <span className="text-[#94a3b8]">Nenhum</span>
                      )}
                    </div>
                    <div>
                      <span className="font-semibold">Canal:</span>{' '}
                      {regra.whatsapp_channels?.name || (
                        <span className="text-[#94a3b8]">Padrão</span>
                      )}
                    </div>
                    <div>
                      <span className="font-semibold">Timing:</span>{' '}
                      <TimingLabel
                        daysBefore={regra.days_before}
                        daysAfter={regra.days_after}
                        sendTime={regra.send_time}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    onClick={() => abrirModalEditar(regra)}
                    className="rounded-full border border-[#e2e8f0] px-4 py-1.5 text-[13px] font-bold text-[#475569] transition hover:bg-[#f8fafc]"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => toggleAtivo(regra.id, regra.is_active)}
                    className={`rounded-full border px-4 py-1.5 text-[13px] font-bold transition ${
                      regra.is_active
                        ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    {regra.is_active ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={fecharModal}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-2xl sm:rounded-[28px] sm:m-4 max-h-[92vh]">
            <h2 className="text-[20px] font-black tracking-[-0.02em] text-[#0f172a]">
              {editandoId ? 'Editar regra' : 'Nova regra'}
            </h2>

            <div className="mt-5 space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-[13px] font-bold text-[#0f172a]">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={handleNomeChange}
                  placeholder="Ex: Convite de membro"
                  className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px] text-[#0f172a] placeholder-[#94a3b8] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>

              {/* Key */}
              <div>
                <label className="block text-[13px] font-bold text-[#0f172a]">
                  Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.key}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                  placeholder="Ex: convite_membro"
                  className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px] font-mono text-[#0f172a] placeholder-[#94a3b8] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>

              {/* Event Type */}
              <div>
                <label className="block text-[13px] font-bold text-[#0f172a]">
                  Tipo de Evento <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.event_type}
                  onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px] text-[#0f172a] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                >
                  <option value="">Selecione um evento</option>
                  {EVENT_TYPES.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Recipient Type */}
              <div>
                <label className="block text-[13px] font-bold text-[#0f172a]">
                  Destinatário <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.recipient_type}
                  onChange={(e) => setForm((f) => ({ ...f, recipient_type: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px] text-[#0f172a] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                >
                  <option value="">Selecione o destinatário</option>
                  {RECIPIENT_TYPES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Template */}
              <div>
                <label className="block text-[13px] font-bold text-[#0f172a]">
                  Template
                </label>
                <select
                  value={form.template_id}
                  onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px] text-[#0f172a] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                >
                  <option value="">Padrão do sistema</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Canal */}
              <div>
                <label className="block text-[13px] font-bold text-[#0f172a]">
                  Canal
                </label>
                <select
                  value={form.channel_id}
                  onChange={(e) => setForm((f) => ({ ...f, channel_id: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px] text-[#0f172a] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                >
                  <option value="">Padrão do sistema</option>
                  {canais.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Timing: Days Before + Days After */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[13px] font-bold text-[#0f172a]">
                    Dias antes
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.days_before}
                    onChange={(e) => setForm((f) => ({ ...f, days_before: e.target.value }))}
                    placeholder="Ex: 15"
                    className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px] text-[#0f172a] placeholder-[#94a3b8] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-[#0f172a]">
                    Dias depois
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.days_after}
                    onChange={(e) => setForm((f) => ({ ...f, days_after: e.target.value }))}
                    placeholder="Ex: 2"
                    className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px] text-[#0f172a] placeholder-[#94a3b8] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              </div>

              {/* Send Time */}
              <div>
                <label className="block text-[13px] font-bold text-[#0f172a]">
                  Horário de envio
                </label>
                <input
                  type="time"
                  value={form.send_time}
                  onChange={(e) => setForm((f) => ({ ...f, send_time: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px] text-[#0f172a] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>

              {/* Toggle Ativo */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    form.is_active ? 'bg-violet-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      form.is_active ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <label className="text-[13px] font-semibold text-[#0f172a]">
                  Regra ativa
                </label>
              </div>
            </div>

            {/* Error message */}
            {erroModal && (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
                {erroModal}
              </div>
            )}

            {/* Footer actions */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={fecharModal}
                disabled={salvando}
                className="rounded-full border border-[#e2e8f0] px-5 py-2.5 text-[14px] font-bold text-[#475569] transition hover:bg-[#f8fafc] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvarRegra}
                disabled={salvando}
                className="rounded-full bg-violet-600 px-5 py-2.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-95 disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Criar regra'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
