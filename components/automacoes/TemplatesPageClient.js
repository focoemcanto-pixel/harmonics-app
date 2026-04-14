'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AdminSummaryCard from '@/components/admin/AdminSummaryCard';
import AutomationBackLink from '@/components/automacoes/AutomationBackLink';

const VARIAVEIS = [
  '{nome_empresa}',
  '{cliente_nome}',
  '{evento_nome}',
  '{evento_data}',
  '{evento_horario}',
  '{evento_local}',
  '{dias_para_evento}',
  '{link_painel_cliente}',
  '{link_painel_membro}',
  '{link_contrato}',
  '{link_repertorio}',
  '{saldo_pendente}',
  '{data_vencimento}',
  '{link_pagamento}',
  '{confirmados}',
  '{pendentes}',
  '{link_escala}',
  '{link_review}',
  '{review_link}',
];

const FORM_INICIAL = {
  name: '',
  key: '',
  channel: 'whatsapp',
  recipient_type: '',
  body: '',
  is_active: true,
};

const MOCK_VARS = {
  '{cliente_nome}': 'Ana',
  '{evento_nome}': 'Casamento Ana & Lucas',
  '{evento_data}': '20/09/2026',
  '{evento_horario}': '19h',
  '{evento_local}': 'Espaço Villa Verde',
  '{dias_para_evento}': '15',
  '{nome_empresa}': 'Harmonics',
  '{link_painel_cliente}': 'https://harmonics.app/painel/demo',
  '{link_painel_membro}': 'https://harmonics.app/membro/invite-demo',
  '{link_contrato}': 'https://harmonics.app/contrato/demo',
  '{link_repertorio}': 'https://harmonics.app/repertorio/demo',
  '{saldo_pendente}': 'R$ 1.500,00',
  '{data_vencimento}': '15/09/2026',
  '{link_pagamento}': 'https://harmonics.app/pagamento/demo',
  '{confirmados}': '8',
  '{pendentes}': '2',
  '{link_escala}': 'https://harmonics.app/escala/demo',
  '{link_review}': 'https://harmonics.app/review/demo',
  '{review_link}': 'https://harmonics.app/review/demo',
};

function renderTemplatePreview(body, vars) {
  if (!body) return '';
  let result = body;
  for (const [key, value] of Object.entries(vars)) {
    result = result.split(key).join(value);
  }
  return result;
}

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

function ChannelBadge({ channel }) {
  const labels = { whatsapp: 'WhatsApp', email: 'Email', sms: 'SMS' };
  return (
    <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">
      {labels[channel] || channel}
    </span>
  );
}

function RecipientBadge({ recipientType }) {
  const labels = {
    musician: 'Músico',
    client: 'Cliente',
    team: 'Equipe',
    admin: 'Admin',
  };
  return (
    <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-bold text-sky-700">
      {labels[recipientType] || recipientType}
    </span>
  );
}

export default function TemplatesPageClient() {
  const [templates, setTemplates] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [varCopiada, setVarCopiada] = useState(null);
  const copiarTimeoutRef = useRef(null);
  const [templateParaTestar, setTemplateParaTestar] = useState(null);
  const [previewVars, setPreviewVars] = useState(MOCK_VARS);
  const [previewRendered, setPreviewRendered] = useState('');

  const carregarTemplates = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);

      const response = await fetch('/api/automation/templates');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar templates');
      }

      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarTemplates();
  }, [carregarTemplates]);

  function abrirModalNovo() {
    setEditandoId(null);
    setForm(FORM_INICIAL);
    setModalAberto(true);
  }

  function abrirModalEditar(template) {
    setEditandoId(template.id);
    setForm({
      name: template.name || '',
      key: template.key || '',
      channel: template.channel || 'whatsapp',
      recipient_type: template.recipient_type || '',
      body: template.body || '',
      is_active: template.is_active !== false,
    });
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditandoId(null);
    setForm(FORM_INICIAL);
  }

  async function salvarTemplate() {
    if (!form.name || !form.key || !form.body || !form.recipient_type) {
      alert('Preencha todos os campos obrigatórios: Nome, Chave, Mensagem e Destinatário.');
      return;
    }

    try {
      setSalvando(true);

      const url = editandoId
        ? `/api/automation/templates/${editandoId}`
        : '/api/automation/templates';

      const method = editandoId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar template');
      }

      await carregarTemplates();
      fecharModal();
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      alert(error.message);
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAtivo(templateId, isActive) {
    try {
      const response = await fetch(`/api/automation/templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar status');
      }

      await carregarTemplates();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert(error.message);
    }
  }

  function copiarVariavel(variavel) {
    navigator.clipboard.writeText(variavel).then(() => {
      if (copiarTimeoutRef.current) clearTimeout(copiarTimeoutRef.current);
      setVarCopiada(variavel);
      copiarTimeoutRef.current = setTimeout(() => setVarCopiada(null), 1500);
    }).catch(() => {
      // Fallback silencioso — clipboard pode estar indisponível em contexto inseguro
    });
  }

  const total = templates.length;
  const ativos = templates.filter((t) => t.is_active).length;
  const inativos = total - ativos;

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
              Templates
            </div>
            <h1 className="mt-1 text-[28px] font-black tracking-[-0.03em] text-[#0f172a]">
              Templates de Mensagens
            </h1>
            <p className="mt-2 max-w-3xl text-[15px] leading-7 text-[#64748b]">
              Gerencie as mensagens automáticas do sistema com variáveis dinâmicas e controle editorial centralizado.
            </p>
          </div>
          <div className="shrink-0">
            <button
              onClick={abrirModalNovo}
              className="rounded-full bg-violet-600 px-5 py-2.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-95"
            >
              + Novo template
            </button>
          </div>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-3 gap-4">
        <AdminSummaryCard label="Total" value={carregando ? '–' : total} tone="default" />
        <AdminSummaryCard label="Ativos" value={carregando ? '–' : ativos} tone="success" />
        <AdminSummaryCard label="Inativos" value={carregando ? '–' : inativos} tone="default" />
      </section>

      {/* Loading */}
      {carregando && (
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-12 text-center shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <div className="mx-auto flex max-w-xs flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
            <p className="text-[14px] font-semibold text-[#64748b]">Carregando templates...</p>
          </div>
        </section>
      )}

      {/* Error */}
      {!carregando && erro && (
        <section className="rounded-[28px] border border-red-200 bg-red-50 p-8 text-center shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <div className="mb-2 text-[32px]">⚠️</div>
          <p className="text-[15px] font-bold text-red-700">{erro}</p>
          <button
            onClick={carregarTemplates}
            className="mt-4 rounded-full border border-red-300 px-5 py-2 text-[13px] font-bold text-red-700 transition hover:bg-red-100"
          >
            Tentar novamente
          </button>
        </section>
      )}

      {/* Empty State */}
      {!carregando && !erro && templates.length === 0 && (
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-12 text-center shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
          <div className="mx-auto max-w-md">
            <div className="mb-4 text-[48px]">🎨</div>
            <h2 className="text-[20px] font-black tracking-[-0.02em] text-[#0f172a]">
              Nenhum template cadastrado
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-[#64748b]">
              Crie seu primeiro template de mensagem automática para começar a usar o sistema de automação.
            </p>
            <div className="mt-6 flex justify-center">
              <button
                onClick={abrirModalNovo}
                className="rounded-full bg-violet-600 px-5 py-2.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-violet-700"
              >
                Criar primeiro template
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Templates List */}
      {!carregando && !erro && templates.length > 0 && (
        <section className="space-y-4">
          {templates.map((template) => {
            const preview =
              template.body && template.body.length > 150
                ? template.body.substring(0, 150) + '...'
                : template.body || '';

            return (
              <div
                key={template.id}
                className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    {/* Name + status */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[16px] font-black tracking-[-0.02em] text-[#0f172a]">
                        {template.name}
                      </span>
                      <StatusBadge isActive={template.is_active} />
                    </div>

                    {/* Key */}
                    <div className="mt-1">
                      <code className="rounded bg-[#f1f5f9] px-2 py-0.5 text-[12px] font-bold text-[#475569]">
                        {template.key}
                      </code>
                    </div>

                    {/* Channel + recipient pills */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <ChannelBadge channel={template.channel} />
                      <RecipientBadge recipientType={template.recipient_type} />
                    </div>

                    {/* Body preview */}
                    <div className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-[#64748b]">
                      {preview}
                    </div>

                    {/* Updated at */}
                    <div className="mt-2 text-[12px] text-[#94a3b8]">
                      Atualizado em {formatarData(template.updated_at)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => {
                        setTemplateParaTestar(template);
                        setPreviewVars(MOCK_VARS);
                        setPreviewRendered(renderTemplatePreview(template.body, MOCK_VARS));
                      }}
                      className="rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-[13px] font-bold text-violet-700 transition hover:bg-violet-100"
                    >
                      Testar
                    </button>
                    <button
                      onClick={() => abrirModalEditar(template)}
                      className="rounded-full border border-[#e2e8f0] px-4 py-1.5 text-[13px] font-bold text-[#475569] transition hover:bg-[#f8fafc]"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => toggleAtivo(template.id, template.is_active)}
                      className={`rounded-full border px-4 py-1.5 text-[13px] font-bold transition ${
                        template.is_active
                          ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {template.is_active ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
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
          <div className="relative z-10 w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-2xl sm:rounded-[28px] sm:m-4 max-h-[92vh]">
            <h2 className="text-[20px] font-black tracking-[-0.02em] text-[#0f172a]">
              {editandoId ? 'Editar template' : 'Novo template'}
            </h2>

            <div className="mt-5 space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-[13px] font-bold text-[#0f172a]">
                  Nome do template <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Confirmação de convite - Músico"
                  className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px] text-[#0f172a] placeholder-[#94a3b8] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>

              {/* Key */}
              <div>
                <label className="block text-[13px] font-bold text-[#0f172a]">
                  Chave única <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.key}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                  placeholder="Ex: confirm_invite_musician"
                  className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 font-mono text-[14px] text-[#0f172a] placeholder-[#94a3b8] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
                <p className="mt-1 text-[12px] text-[#94a3b8]">
                  Use snake_case — será usada no código
                </p>
              </div>

              {/* Canal + Destinatário (side by side on sm+) */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Canal */}
                <div>
                  <label className="block text-[13px] font-bold text-[#0f172a]">
                    Canal
                  </label>
                  <select
                    value={form.channel}
                    onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px] text-[#0f172a] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>

                {/* Destinatário */}
                <div>
                  <label className="block text-[13px] font-bold text-[#0f172a]">
                    Destinatário <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.recipient_type}
                    onChange={(e) => setForm((f) => ({ ...f, recipient_type: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[14px] text-[#0f172a] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  >
                    <option value="">Selecione o tipo</option>
                    <option value="musician">Músico</option>
                    <option value="client">Cliente</option>
                    <option value="team">Equipe</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              {/* Body + Variáveis */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Body */}
                <div className="lg:col-span-2">
                  <label className="block text-[13px] font-bold text-[#0f172a]">
                    Mensagem <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={8}
                    value={form.body}
                    onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                    placeholder="Digite a mensagem usando variáveis como {cliente_nome}, {evento_nome}, etc."
                    className="mt-1.5 w-full rounded-xl border border-[#e2e8f0] px-4 py-2.5 font-mono text-[13px] leading-relaxed text-[#0f172a] placeholder-[#94a3b8] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  />
                  <div className="mt-1 text-right text-[11px] text-[#94a3b8]">
                    {form.body.length} caracteres
                  </div>
                </div>

                {/* Variáveis disponíveis */}
                <div>
                  <label className="block text-[13px] font-bold text-[#0f172a]">
                    Variáveis disponíveis
                  </label>
                  <p className="mt-0.5 text-[11px] text-[#94a3b8]">Clique para copiar</p>
                  <div className="mt-1.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {VARIAVEIS.map((v) => (
                        <button
                          key={v}
                          type="button"
                          title="Clique para copiar"
                          onClick={() => copiarVariavel(v)}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] font-semibold transition-all ${
                            varCopiada === v
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-white text-[#475569] hover:bg-violet-50 hover:text-violet-700 border border-[#e2e8f0] hover:border-violet-200'
                          }`}
                        >
                          {varCopiada === v ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 shrink-0">
                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                              </svg>
                              {v}
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 shrink-0 opacity-40">
                                <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                                <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
                              </svg>
                              {v}
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ativo toggle */}
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
                  Template ativo
                </label>
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
                onClick={salvarTemplate}
                disabled={salvando}
                className="rounded-full bg-violet-600 px-5 py-2.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de preview / teste de template */}
      {templateParaTestar && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setTemplateParaTestar(null)}
          />
          <div className="relative z-10 w-full max-w-3xl overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-2xl sm:rounded-[28px] sm:m-4 max-h-[92vh]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[20px] font-black tracking-[-0.02em] text-[#0f172a]">
                  Testar template
                </h2>
                <p className="mt-0.5 text-[13px] text-[#64748b]">
                  <span className="font-bold">{templateParaTestar.name}</span> — preencha as variáveis e veja o preview
                </p>
              </div>
              <button
                onClick={() => setTemplateParaTestar(null)}
                className="rounded-full p-1.5 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#475569]"
                aria-label="Fechar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Painel de variáveis */}
              <div>
                <label className="mb-2 block text-[13px] font-bold text-[#0f172a]">
                  Variáveis mock (editáveis)
                </label>
                <div className="space-y-2 overflow-y-auto max-h-72 pr-1">
                  {Object.entries(previewVars).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-40 shrink-0 rounded bg-[#f1f5f9] px-2 py-1 font-mono text-[11px] font-bold text-[#475569]">
                        {key}
                      </span>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => {
                          const newVars = { ...previewVars, [key]: e.target.value };
                          setPreviewVars(newVars);
                          setPreviewRendered(renderTemplatePreview(templateParaTestar.body, newVars));
                        }}
                        className="flex-1 rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-[12px] text-[#0f172a] focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-100"
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setPreviewRendered(renderTemplatePreview(templateParaTestar.body, previewVars))}
                  className="mt-4 w-full rounded-xl bg-violet-600 py-2.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-violet-700"
                >
                  Renderizar preview
                </button>
              </div>

              {/* Preview final */}
              <div>
                <label className="mb-2 block text-[13px] font-bold text-[#0f172a]">
                  Preview final da mensagem
                </label>
                <div className="min-h-[180px] rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-[13px] leading-relaxed text-[#475569] whitespace-pre-wrap">
                  {previewRendered || (
                    <span className="text-[#94a3b8] italic">
                      Clique em &quot;Renderizar preview&quot; para ver o resultado
                    </span>
                  )}
                </div>
                {previewRendered && (
                  <p className="mt-1.5 text-right text-[11px] text-[#94a3b8]">
                    {previewRendered.length} caracteres
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setTemplateParaTestar(null)}
                className="rounded-full border border-[#e2e8f0] px-5 py-2.5 text-[14px] font-bold text-[#475569] transition hover:bg-[#f8fafc]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
