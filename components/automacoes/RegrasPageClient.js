'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminSummaryCard from '@/components/admin/AdminSummaryCard';
import AutomationBackLink from '@/components/automacoes/AutomationBackLink';

const EVENT_TYPES = [
  { value: 'invite_member', label: 'Convite ao membro' },
  { value: 'contract_signed_client', label: 'Contrato assinado (cliente)' },
  { value: 'repertoire_pending_15_days_client', label: 'Repertório pendente 15 dias (cliente)' },
  { value: 'payment_pending_2_days_client', label: 'Pagamento pendente 2 dias (cliente)' },
  { value: 'post_event_review_request_client', label: 'Avaliação pós-evento (cliente)' },
  { value: 'schedule_fully_confirmed_admin', label: 'Escala confirmada (admin)' },
  { value: 'schedule_pending_15_days_admin', label: 'Escala pendente 15 dias (admin)' },
];

const RECIPIENT_TYPES = [
  { value: 'client', label: 'Cliente' },
  { value: 'member', label: 'Membro' },
  { value: 'admin', label: 'Admin' },
  { value: 'financial', label: 'Financeiro' },
];

const FORM_INICIAL = {
  key: '',
  name: '',
  event_type: '',
  recipient_type: '',
  template_id: '',
  channel_id: '',
  days_before: '',
  days_after: '',
  send_time: '',
  is_active: true,
};

function formatarData(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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

export default function RegrasPageClient() {
  const [regras, setRegras] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [canais, setCanais] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
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

  function abrirCriar() {
    setEditandoId(null);
    setForm(FORM_INICIAL);
    setModalAberto(true);
  }

  function abrirEditar(regra) {
    setEditandoId(regra.id);
    setForm({
      key: regra.key || '',
      name: regra.name || '',
      event_type: regra.event_type || '',
      recipient_type: regra.recipient_type || '',
      template_id: regra.template_id || '',
      channel_id: regra.channel_id || '',
      days_before: regra.days_before ?? '',
      days_after: regra.days_after ?? '',
      send_time: regra.send_time || '',
      is_active: regra.is_active !== false,
    });
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditandoId(null);
    setForm(FORM_INICIAL);
  }

  async function salvar() {
    if (!form.key || !form.name || !form.event_type || !form.recipient_type) {
      alert('Preencha os campos obrigatórios: Key, Nome, Tipo de Evento e Destinatário');
      return;
    }

    setSalvando(true);
    try {
      const payload = {
        key: form.key,
        name: form.name,
        event_type: form.event_type,
        recipient_type: form.recipient_type,
        template_id: form.template_id || null,
        channel_id: form.channel_id || null,
        days_before: form.days_before !== '' ? Number(form.days_before) : null,
        days_after: form.days_after !== '' ? Number(form.days_after) : null,
        send_time: form.send_time || null,
        is_active: form.is_active,
      };

      const url = editandoId
        ? `/api/automation/rules/${editandoId}`
        : '/api/automation/rules';
      const method = editandoId ? 'PATCH' : 'POST';

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
      console.error('Erro ao salvar:', error);
      alert(error.message);
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAtivo(regra) {
    try {
      const response = await fetch(`/api/automation/rules/${regra.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !regra.is_active }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao atualizar status');
      }

      await carregarDados();
    } catch (error) {
      console.error('Erro ao alternar status:', error);
      alert(error.message);
    }
  }

  const totalRegras = regras.length;
  const regrasAtivas = regras.filter((r) => r.is_active).length;
  const regrasInativas = totalRegras - regrasAtivas;

  if (carregando) {
    return (
      <div className="space-y-6">
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <div className="h-5 w-32 animate-pulse rounded bg-gray-100" />
          <div className="mt-2 h-8 w-64 animate-pulse rounded bg-gray-100" />
          <div className="mt-2 h-4 w-96 animate-pulse rounded bg-gray-100" />
        </section>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-[20px] bg-gray-100"
            />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-[20px] bg-gray-100"
            />
          ))}
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="rounded-[20px] border border-red-200 bg-red-50 p-6 text-center">
        <div className="text-[15px] font-bold text-red-700">Erro ao carregar regras</div>
        <div className="mt-1 text-[13px] text-red-600">{erro}</div>
        <button
          onClick={carregarDados}
          className="mt-4 rounded-full bg-red-100 px-4 py-2 text-[13px] font-bold text-red-700 hover:bg-red-200"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <AutomationBackLink />
      </div>

      {/* Hero */}
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
        <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">
          Automação
        </div>
        <h1 className="mt-1 text-[28px] font-black tracking-[-0.03em] text-[#0f172a]">
          Regras de Automação
        </h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-7 text-[#64748b]">
          Defina quando, para quem e por qual canal cada automação do sistema deve ser executada.
        </p>
      </section>

      {/* Cards resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <AdminSummaryCard label="Total de Regras" value={totalRegras} />
        <AdminSummaryCard label="Regras Ativas" value={regrasAtivas} />
        <AdminSummaryCard label="Regras Inativas" value={regrasInativas} />
      </div>

      {/* Ações */}
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-black tracking-[-0.02em] text-[#0f172a]">
          {totalRegras} {totalRegras === 1 ? 'regra' : 'regras'} cadastrada{totalRegras === 1 ? '' : 's'}
        </h2>
        <button
          onClick={abrirCriar}
          className="rounded-full bg-violet-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-violet-700"
        >
          + Nova Regra
        </button>
      </div>

      {/* Empty state */}
      {regras.length === 0 && (
        <div className="rounded-[20px] border border-dashed border-[#dbe3ef] bg-white p-10 text-center">
          <div className="text-[16px] font-bold text-[#0f172a]">Nenhuma regra cadastrada</div>
          <p className="mt-1 text-[14px] text-[#64748b]">
            Crie sua primeira regra de automação para começar.
          </p>
          <button
            onClick={abrirCriar}
            className="mt-4 rounded-full bg-violet-600 px-5 py-2.5 text-[13px] font-bold text-white"
          >
            Criar primeira regra
          </button>
        </div>
      )}

      {/* Lista de regras */}
      <div className="space-y-3">
        {regras.map((regra) => (
          <div
            key={regra.id}
            className="rounded-[20px] border border-[#dbe3ef] bg-white p-5 shadow-[0_4px_12px_rgba(17,24,39,0.04)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[16px] font-black tracking-[-0.02em] text-[#0f172a]">
                    {regra.name}
                  </span>
                  <StatusBadge isActive={regra.is_active} />
                </div>
                <div className="font-mono text-[11px] text-[#94a3b8]">{regra.key}</div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <EventTypeBadge eventType={regra.event_type} />
                  <RecipientBadge recipientType={regra.recipient_type} />
                  {regra.template && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                      Template: {regra.template.name}
                    </span>
                  )}
                  {regra.channel && (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-bold text-green-700">
                      Canal: {regra.channel.name}
                    </span>
                  )}
                </div>
                {(regra.days_before != null || regra.days_after != null || regra.send_time) && (
                  <div className="text-[12px] text-[#64748b]">
                    {regra.days_before != null && (
                      <span className="mr-3">{regra.days_before} dias antes</span>
                    )}
                    {regra.days_after != null && (
                      <span className="mr-3">{regra.days_after} dias depois</span>
                    )}
                    {regra.send_time && <span>às {regra.send_time}</span>}
                  </div>
                )}
                <div className="text-[11px] text-[#94a3b8]">
                  Atualizado em {formatarData(regra.updated_at || regra.created_at)}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => toggleAtivo(regra)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
                    regra.is_active
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  }`}
                >
                  {regra.is_active ? 'Desativar' : 'Ativar'}
                </button>
                <button
                  onClick={() => abrirEditar(regra)}
                  className="rounded-full bg-violet-100 px-3 py-1.5 text-[12px] font-bold text-violet-700 transition hover:bg-violet-200"
                >
                  Editar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de criação/edição */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center">
          <div className="w-full max-w-lg rounded-[24px] bg-white p-6 shadow-2xl">
            <h2 className="text-[18px] font-black tracking-[-0.02em] text-[#0f172a]">
              {editandoId ? 'Editar Regra' : 'Nova Regra'}
            </h2>

            <div className="mt-4 space-y-4">
              {/* Nome */}
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#64748b]">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Notificar cliente - contrato assinado"
                  className="w-full rounded-[12px] border border-[#dbe3ef] px-4 py-2.5 text-[14px] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>

              {/* Key */}
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#64748b]">
                  Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.key}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      key: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                    }))
                  }
                  placeholder="Ex: notificar_cliente_contrato_assinado"
                  className="w-full rounded-[12px] border border-[#dbe3ef] px-4 py-2.5 font-mono text-[13px] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>

              {/* Event Type */}
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#64748b]">
                  Tipo de Evento <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.event_type}
                  onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value }))}
                  className="w-full rounded-[12px] border border-[#dbe3ef] px-4 py-2.5 text-[14px] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                >
                  <option value="">Selecione um evento</option>
                  {EVENT_TYPES.map((et) => (
                    <option key={et.value} value={et.value}>
                      {et.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Recipient Type */}
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#64748b]">
                  Destinatário <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.recipient_type}
                  onChange={(e) => setForm((f) => ({ ...f, recipient_type: e.target.value }))}
                  className="w-full rounded-[12px] border border-[#dbe3ef] px-4 py-2.5 text-[14px] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                >
                  <option value="">Selecione o destinatário</option>
                  {RECIPIENT_TYPES.map((rt) => (
                    <option key={rt.value} value={rt.value}>
                      {rt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Template */}
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#64748b]">
                  Template (opcional)
                </label>
                <select
                  value={form.template_id}
                  onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}
                  className="w-full rounded-[12px] border border-[#dbe3ef] px-4 py-2.5 text-[14px] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                >
                  <option value="">Sem template (usar padrão do sistema)</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Canal */}
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#64748b]">
                  Canal (opcional)
                </label>
                <select
                  value={form.channel_id}
                  onChange={(e) => setForm((f) => ({ ...f, channel_id: e.target.value }))}
                  className="w-full rounded-[12px] border border-[#dbe3ef] px-4 py-2.5 text-[14px] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                >
                  <option value="">Sem canal (usar padrão/env vars)</option>
                  {canais.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Timing */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-[#64748b]">
                    Dias antes
                  </label>
                  <input
                    type="number"
                    value={form.days_before}
                    onChange={(e) => setForm((f) => ({ ...f, days_before: e.target.value }))}
                    placeholder="—"
                    className="w-full rounded-[12px] border border-[#dbe3ef] px-3 py-2.5 text-[14px] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-[#64748b]">
                    Dias depois
                  </label>
                  <input
                    type="number"
                    value={form.days_after}
                    onChange={(e) => setForm((f) => ({ ...f, days_after: e.target.value }))}
                    placeholder="—"
                    className="w-full rounded-[12px] border border-[#dbe3ef] px-3 py-2.5 text-[14px] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-[#64748b]">
                    Horário
                  </label>
                  <input
                    type="time"
                    step="60"
                    value={form.send_time}
                    onChange={(e) => setForm((f) => ({ ...f, send_time: e.target.value }))}
                    className="w-full rounded-[12px] border border-[#dbe3ef] px-3 py-2.5 text-[14px] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between rounded-[12px] border border-[#dbe3ef] px-4 py-3">
                <span className="text-[14px] font-bold text-[#0f172a]">Regra ativa</span>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    form.is_active ? 'bg-violet-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      form.is_active ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Ações do modal */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={fecharModal}
                className="flex-1 rounded-full border border-[#dbe3ef] px-4 py-2.5 text-[13px] font-bold text-[#64748b] hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="flex-1 rounded-full bg-violet-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
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
