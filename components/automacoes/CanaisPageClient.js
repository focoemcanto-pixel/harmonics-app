'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminSummaryCard from '@/components/admin/AdminSummaryCard';
import AutomationBackLink from '@/components/automacoes/AutomationBackLink';

const FORM_INICIAL = {
  name: '',
  provider: 'wasender',
  api_url: '',
  api_key: '',
  instance_id: '',
  sender_number: '',
  admin_alert_number: '',
  is_active: true,
  is_default: false,
};

const PROVIDERS = [
  { value: 'wasender', label: 'WaSender' },
  { value: 'evolution-api', label: 'Evolution API' },
  { value: 'twilio', label: 'Twilio' },
  { value: 'other', label: 'Outro' },
];

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

function ProviderLabel({ provider }) {
  const found = PROVIDERS.find((p) => p.value === provider);
  return (
    <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">
      {found ? found.label : provider}
    </span>
  );
}

export default function CanaisPageClient() {
  const [canais, setCanais] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);

  const carregarCanais = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);

      const response = await fetch('/api/automation/channels');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar canais');
      }

      setCanais(data.channels || []);
    } catch (error) {
      console.error('Erro ao carregar canais:', error);
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarCanais();
  }, [carregarCanais]);

  function abrirModalNovo() {
    setEditandoId(null);
    setForm(FORM_INICIAL);
    setModalAberto(true);
  }

  function abrirModalEditar(canal) {
    setEditandoId(canal.id);
    setForm({
      name: canal.name || '',
      provider: canal.provider || 'wasender',
      api_url: canal.api_url || '',
      api_key: '',
      instance_id: canal.instance_id || '',
      sender_number: canal.sender_number || '',
      admin_alert_number: canal.admin_alert_number || '',
      is_active: canal.is_active !== false,
      is_default: canal.is_default === true,
    });
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditandoId(null);
    setForm(FORM_INICIAL);
  }

  async function salvarCanal() {
    if (!form.name) {
      alert('O nome do canal é obrigatório.');
      return;
    }

    if (
      form.is_default &&
      canais.some((c) => c.is_default && c.id !== editandoId)
    ) {
      const confirmou = window.confirm(
        'Ao definir este canal como padrão, o canal padrão atual perderá essa marcação. Deseja continuar?'
      );
      if (!confirmou) return;
    }

    try {
      setSalvando(true);

      const url = editandoId
        ? `/api/automation/channels/${editandoId}`
        : '/api/automation/channels';

      const method = editandoId ? 'PATCH' : 'POST';

      const payload = { ...form };
      if (!payload.api_key) delete payload.api_key;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar canal');
      }

      await carregarCanais();
      fecharModal();
    } catch (error) {
      console.error('Erro ao salvar canal:', error);
      alert(error.message);
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAtivo(canalId, isActive) {
    try {
      const response = await fetch(`/api/automation/channels/${canalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar status');
      }

      await carregarCanais();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert(error.message);
    }
  }

  async function definirPadrao(canalId) {
    const outros = canais.filter((c) => c.is_default && c.id !== canalId);
    if (outros.length > 0) {
      const confirmou = window.confirm(
        'Ao definir este canal como padrão, o canal padrão atual perderá essa marcação. Deseja continuar?'
      );
      if (!confirmou) return;
    }

    try {
      const response = await fetch(`/api/automation/channels/${canalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true }),
      });

      if (!response.ok) {
        throw new Error('Erro ao definir canal padrão');
      }

      await carregarCanais();
    } catch (error) {
      console.error('Erro ao definir canal padrão:', error);
      alert(error.message);
    }
  }

  const total = canais.length;
  const ativos = canais.filter((c) => c.is_active).length;
  const canalPadrao = canais.find((c) => c.is_default);

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <AutomationBackLink />
      </div>

      {/* Hero Section */}
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">
              Canais
            </div>
            <h1 className="mt-1 text-[28px] font-black tracking-[-0.03em] text-[#0f172a]">
              Canais de Envio
            </h1>
            <p className="mt-2 max-w-3xl text-[15px] leading-7 text-[#64748b]">
              Configure APIs de WhatsApp, instâncias e números de envio. Gerencie múltiplos canais e alterne entre eles sem alterar código.
            </p>
          </div>
          <div className="shrink-0">
            <button
              onClick={abrirModalNovo}
              className="rounded-full bg-violet-600 px-5 py-2.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-95"
            >
              + Novo canal
            </button>
          </div>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-3 gap-4">
        <AdminSummaryCard label="Total" value={carregando ? '–' : total} tone="default" />
        <AdminSummaryCard label="Ativos" value={carregando ? '–' : ativos} tone="success" />
        <AdminSummaryCard
          label="Canal padrão"
          value={carregando ? '–' : canalPadrao ? canalPadrao.name : '—'}
          tone="accent"
        />
      </section>

      {/* Loading */}
      {carregando && (
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-12 text-center shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <div className="mx-auto flex max-w-xs flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
            <p className="text-[14px] font-semibold text-[#64748b]">Carregando canais...</p>
          </div>
        </section>
      )}

      {/* Error */}
      {!carregando && erro && (
        <section className="rounded-[28px] border border-red-200 bg-red-50 p-8 text-center shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <div className="mb-2 text-[32px]">⚠️</div>
          <p className="text-[15px] font-bold text-red-700">{erro}</p>
          <button
            onClick={carregarCanais}
            className="mt-4 rounded-full border border-red-300 px-5 py-2 text-[13px] font-bold text-red-700 transition hover:bg-red-100"
          >
            Tentar novamente
          </button>
        </section>
      )}

      {/* Empty State */}
      {!carregando && !erro && canais.length === 0 && (
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-12 text-center shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <div className="mx-auto max-w-md">
            <div className="mb-4 text-[48px]">📡</div>
            <h2 className="text-[20px] font-black tracking-[-0.02em] text-[#0f172a]">
              Nenhum canal cadastrado
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-[#64748b]">
              Configure seu primeiro canal de WhatsApp para começar a usar o sistema de envio automático.
            </p>
            <div className="mt-6 flex justify-center">
              <button
                onClick={abrirModalNovo}
                className="rounded-full bg-violet-600 px-5 py-2.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-violet-700"
              >
                Criar primeiro canal
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Channels List */}
      {!carregando && !erro && canais.length > 0 && (
        <section className="space-y-4">
          {canais.map((canal) => (
            <div
              key={canal.id}
              className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  {/* Name + badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-black tracking-[-0.02em] text-[#0f172a]">
                      {canal.name}
                    </span>
                    <StatusBadge isActive={canal.is_active} />
                    {canal.is_default && (
                      <span className="rounded-full bg-violet-600 px-3 py-1 text-[11px] font-bold text-white">
                        Padrão
                      </span>
                    )}
                  </div>

                  {/* Provider */}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <ProviderLabel provider={canal.provider} />
                  </div>

                  {/* Details */}
                  <div className="mt-2 space-y-0.5 text-[13px] text-[#64748b]">
                    {canal.sender_number && (
                      <div>
                        <span className="font-semibold">Número:</span> {canal.sender_number}
                      </div>
                    )}
                    {canal.instance_id && (
                      <div>
                        <span className="font-semibold">Instance:</span>{' '}
                        <code className="rounded bg-[#f1f5f9] px-1.5 py-0.5 text-[12px] font-bold text-[#475569]">
                          {canal.instance_id}
                        </code>
                      </div>
                    )}
                  </div>

                  {/* Created at */}
                  <div className="mt-2 text-[12px] text-[#94a3b8]">
                    Criado em {formatarData(canal.created_at)}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {!canal.is_default && (
                    <button
                      onClick={() => definirPadrao(canal.id)}
                      className="rounded-full border border-violet-200 px-4 py-1.5 text-[13px] font-bold text-violet-700 transition hover:bg-violet-50"
                    >
                      Definir padrão
                    </button>
                  )}
                  <button
                    onClick={() => abrirModalEditar(canal)}
                    className="rounded-full border border-[#e2e8f0] px-4 py-1.5 text-[13px] font-bold text-[#475569] transition hover:bg-[#f8fafc]"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => toggleAtivo(canal.id, canal.is_active)}
                    className={`rounded-full border px-4 py-1.5 text-[13px] font-bold transition ${
                      canal.is_active
                        ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    {canal.is_active ? 'Desativar' : 'Ativar'}
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
              {editandoId ? 'Editar canal' : 'Novo canal'}
            </h2>

            <div className="mt-5 space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-[13px] font-bold text-[#0f172a]">
                  Nome do canal <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Canal Principal WaSender"
                  className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px] text-[#0f172a] placeholder-[#94a3b8] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>

              {/* Provider */}
              <div>
                <label className="block text-[13px] font-bold text-[#0f172a]">
                  Provider
                </label>
                <select
                  value={form.provider}
                  onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px] text-[#0f172a] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* API URL */}
              <div>
                <label className="block text-[13px] font-bold text-[#0f172a]">
                  API URL
                </label>
                <input
                  type="url"
                  value={form.api_url}
                  onChange={(e) => setForm((f) => ({ ...f, api_url: e.target.value }))}
                  placeholder="https://api.exemplo.com"
                  className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px] text-[#0f172a] placeholder-[#94a3b8] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="block text-[13px] font-bold text-[#0f172a]">
                  API Key
                </label>
                <input
                  type="password"
                  value={form.api_key}
                  onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
                  placeholder={editandoId ? 'Deixe em branco para manter a atual' : 'Token de autenticação'}
                  className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px] text-[#0f172a] placeholder-[#94a3b8] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>

              {/* Instance ID + Sender Number */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[13px] font-bold text-[#0f172a]">
                    Instance ID
                  </label>
                  <input
                    type="text"
                    value={form.instance_id}
                    onChange={(e) => setForm((f) => ({ ...f, instance_id: e.target.value }))}
                    placeholder="Ex: minha-instancia"
                    className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px] text-[#0f172a] placeholder-[#94a3b8] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-[#0f172a]">
                    Número de envio
                  </label>
                  <input
                    type="tel"
                    value={form.sender_number}
                    onChange={(e) => setForm((f) => ({ ...f, sender_number: e.target.value }))}
                    placeholder="Ex: 5511999999999"
                    className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px] text-[#0f172a] placeholder-[#94a3b8] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              </div>

              {/* Admin Alert Number */}
              <div>
                <label className="block text-[13px] font-bold text-[#0f172a]">
                  Número de alerta admin
                </label>
                <input
                  type="tel"
                  value={form.admin_alert_number}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, admin_alert_number: e.target.value }))
                  }
                  placeholder="Ex: 5511888888888"
                  className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px] text-[#0f172a] placeholder-[#94a3b8] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-3">
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
                    Canal ativo
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, is_default: !f.is_default }))}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      form.is_default ? 'bg-violet-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        form.is_default ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <label className="text-[13px] font-semibold text-[#0f172a]">
                    Canal padrão
                  </label>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={fecharModal}
                className="rounded-full border border-[#e2e8f0] px-5 py-2.5 text-[14px] font-bold text-[#475569] transition hover:bg-[#f8fafc]"
              >
                Cancelar
              </button>
              <button
                onClick={salvarCanal}
                disabled={salvando}
                className="rounded-full bg-violet-600 px-5 py-2.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
