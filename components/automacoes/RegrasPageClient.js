'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import AdminSummaryCard from '@/components/admin/AdminSummaryCard';
import AutomationBackLink from '@/components/automacoes/AutomationBackLink';

const EVENT_TYPES = [
  { value: 'invite_member', label: 'Convite de escala (membro)' },
  { value: 'contract_signed_client', label: 'Contrato assinado (cliente)' },
  { value: 'repertoire_finalized_client', label: 'Repertório finalizado (cliente)' },
  { value: 'repertoire_pending_15_days_client', label: 'Lembrete de resposta pendente (cliente)' },
  { value: 'payment_pending_2_days_client', label: 'Saldo pendente (cliente)' },
  { value: 'post_event_review_request_client', label: 'Pós-evento (cliente)' },
  { value: 'schedule_fully_confirmed_admin', label: 'Confirmação do membro (admin)' },
  { value: 'member_declined_admin', label: 'Recusa do membro (admin)' },
  { value: 'schedule_pending_15_days_admin', label: 'Aviso interno admin (pendência)' },
];

const RECIPIENT_TYPES = [
  { value: 'client', label: 'Cliente' },
  { value: 'member', label: 'Membro' },
  { value: 'admin', label: 'Admin' },
  { value: 'financial', label: 'Financeiro' },
];

const QUICK_PRESETS = [
  {
    id: 'invite_member',
    title: 'Convite de escala',
    subtitle: 'Ao salvar escala → enviar convite para membros escalados',
    event_type: 'invite_member',
    recipient_type: 'member',
    key: 'convite_escala_rapido',
    name: 'Convite de escala ao salvar escala',
    triggerType: 'instant',
    autoSendLabel: 'Enviar automaticamente ao salvar escala?',
  },
  {
    id: 'contract_signed_client',
    title: 'Contrato assinado',
    subtitle: 'Contrato assinado → enviar mensagem ao cliente',
    event_type: 'contract_signed_client',
    recipient_type: 'client',
    key: 'contrato_assinado_rapido',
    name: 'Contrato assinado → mensagem automática',
    triggerType: 'instant',
  },
  {
    id: 'repertoire_finalized_client',
    title: 'Repertório finalizado',
    subtitle: 'Repertório finalizado → enviar link/PDF',
    event_type: 'repertoire_finalized_client',
    recipient_type: 'client',
    key: 'repertorio_finalizado_rapido',
    name: 'Repertório finalizado → envio automático',
    triggerType: 'instant',
  },
  {
    id: 'repertoire_pending_15_days_client',
    title: 'Lembrete de resposta pendente',
    subtitle: 'X dias antes/depois para cobrar retorno do cliente',
    event_type: 'repertoire_pending_15_days_client',
    recipient_type: 'client',
    key: 'lembrete_resposta_pendente',
    name: 'Lembrete de resposta pendente',
    triggerType: 'scheduled',
    days_before: 15,
    send_time: '09:00',
  },
  {
    id: 'payment_pending_2_days_client',
    title: 'Saldo pendente',
    subtitle: 'Cobrança automática com gatilho programado',
    event_type: 'payment_pending_2_days_client',
    recipient_type: 'financial',
    key: 'saldo_pendente_rapido',
    name: 'Saldo pendente',
    triggerType: 'scheduled',
    days_before: 2,
    send_time: '10:00',
  },
  {
    id: 'post_event_review_request_client',
    title: 'Pós-evento',
    subtitle: 'Após evento → solicitar avaliação',
    event_type: 'post_event_review_request_client',
    recipient_type: 'client',
    key: 'pos_evento_rapido',
    name: 'Pós-evento',
    triggerType: 'scheduled',
    days_after: 1,
    send_time: '10:00',
  },
  {
    id: 'schedule_pending_15_days_admin',
    title: 'Aviso interno admin',
    subtitle: 'Pendência interna com alerta programado',
    event_type: 'schedule_pending_15_days_admin',
    recipient_type: 'admin',
    key: 'aviso_interno_admin_rapido',
    name: 'Aviso interno admin',
    triggerType: 'scheduled',
    days_before: 15,
    send_time: '09:00',
  },
];

const ADVANCED_FORM = {
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

const QUICK_FORM = {
  presetId: '',
  template_id: '',
  channel_id: '',
  is_active: true,
  auto_send: true,
  manual_enabled: true,
  days_before: '',
  days_after: '',
  send_time: '',
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

function isScheduledRule(rule) {
  return rule.days_before != null || rule.days_after != null || Boolean(rule.send_time);
}

function getEventLabel(eventType) {
  return EVENT_TYPES.find((e) => e.value === eventType)?.label || eventType;
}

function getRecipientLabel(recipientType) {
  return RECIPIENT_TYPES.find((r) => r.value === recipientType)?.label || recipientType;
}

function getPresetFromRule(rule) {
  return QUICK_PRESETS.find(
    (preset) => preset.event_type === rule.event_type && preset.recipient_type === rule.recipient_type
  );
}

function StatusBadge({ isActive }) {
  return isActive ? (
    <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-700">
      Automático ativo
    </span>
  ) : (
    <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-bold text-gray-600">
      Automático inativo
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
  const [modalModo, setModalModo] = useState('quick');
  const [salvando, setSalvando] = useState(false);
  const [advancedForm, setAdvancedForm] = useState(ADVANCED_FORM);
  const [quickForm, setQuickForm] = useState(QUICK_FORM);

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

  const regrasInstantaneas = useMemo(
    () => regras.filter((regra) => !isScheduledRule(regra)),
    [regras]
  );
  const regrasProgramadas = useMemo(
    () => regras.filter((regra) => isScheduledRule(regra)),
    [regras]
  );

  function abrirCriarPreset(presetId) {
    const preset = QUICK_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

    setEditandoId(null);
    setModalModo('quick');
    setQuickForm({
      ...QUICK_FORM,
      presetId: preset.id,
      days_before: preset.days_before ?? '',
      days_after: preset.days_after ?? '',
      send_time: preset.send_time ?? '',
    });
    setModalAberto(true);
  }

  function abrirCriarAvancado() {
    setEditandoId(null);
    setModalModo('advanced');
    setAdvancedForm(ADVANCED_FORM);
    setModalAberto(true);
  }

  function abrirEditar(regra, forceMode) {
    const preset = getPresetFromRule(regra);
    const modoSelecionado = forceMode || (preset ? 'quick' : 'advanced');

    setEditandoId(regra.id);
    setModalModo(modoSelecionado);

    if (modoSelecionado === 'quick' && preset) {
      setQuickForm({
        presetId: preset.id,
        template_id: regra.template_id || '',
        channel_id: regra.channel_id || '',
        is_active: regra.is_active !== false,
        auto_send: regra.is_active !== false,
        manual_enabled: true,
        days_before: regra.days_before ?? preset.days_before ?? '',
        days_after: regra.days_after ?? preset.days_after ?? '',
        send_time: regra.send_time || preset.send_time || '',
      });
    } else {
      setAdvancedForm({
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
    }

    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditandoId(null);
    setModalModo('quick');
    setQuickForm(QUICK_FORM);
    setAdvancedForm(ADVANCED_FORM);
  }

  async function salvarQuick() {
    const preset = QUICK_PRESETS.find((item) => item.id === quickForm.presetId);
    if (!preset) {
      alert('Selecione um preset de regra rápida.');
      return;
    }

    setSalvando(true);
    try {
      const payload = {
        key: preset.key,
        name: preset.name,
        event_type: preset.event_type,
        recipient_type: preset.recipient_type,
        template_id: quickForm.template_id || null,
        channel_id: quickForm.channel_id || null,
        days_before:
          preset.triggerType === 'scheduled' && quickForm.days_before !== ''
            ? Number(quickForm.days_before)
            : null,
        days_after:
          preset.triggerType === 'scheduled' && quickForm.days_after !== ''
            ? Number(quickForm.days_after)
            : null,
        send_time:
          preset.triggerType === 'scheduled' ? quickForm.send_time || null : null,
        is_active: Boolean(quickForm.is_active && quickForm.auto_send),
      };

      const url = editandoId ? `/api/automation/rules/${editandoId}` : '/api/automation/rules';
      const method = editandoId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao salvar regra rápida');

      await carregarDados();
      fecharModal();
    } catch (error) {
      console.error('Erro ao salvar regra rápida:', error);
      alert(error.message);
    } finally {
      setSalvando(false);
    }
  }

  async function salvarAvancado() {
    if (
      !advancedForm.key ||
      !advancedForm.name ||
      !advancedForm.event_type ||
      !advancedForm.recipient_type
    ) {
      alert('Preencha os campos obrigatórios: Key, Nome, Tipo de Evento e Destinatário');
      return;
    }

    setSalvando(true);
    try {
      const payload = {
        key: advancedForm.key,
        name: advancedForm.name,
        event_type: advancedForm.event_type,
        recipient_type: advancedForm.recipient_type,
        template_id: advancedForm.template_id || null,
        channel_id: advancedForm.channel_id || null,
        days_before:
          advancedForm.days_before !== '' ? Number(advancedForm.days_before) : null,
        days_after: advancedForm.days_after !== '' ? Number(advancedForm.days_after) : null,
        send_time: advancedForm.send_time || null,
        is_active: advancedForm.is_active,
      };

      const url = editandoId ? `/api/automation/rules/${editandoId}` : '/api/automation/rules';
      const method = editandoId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao salvar regra avançada');

      await carregarDados();
      fecharModal();
    } catch (error) {
      console.error('Erro ao salvar regra avançada:', error);
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

  const presetSelecionado = QUICK_PRESETS.find((preset) => preset.id === quickForm.presetId);

  return (
    <div className="space-y-6">
      <div>
        <AutomationBackLink />
      </div>

      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
        <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">Automação</div>
        <h1 className="mt-1 text-[28px] font-black tracking-[-0.03em] text-[#0f172a]">Regras rápidas</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-7 text-[#64748b]">
          Configure gatilhos reais do produto com uma camada premium e objetiva. O motor atual continua
          ativo por baixo, com suporte à camada avançada quando necessário.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <AdminSummaryCard label="Total de Regras" value={totalRegras} />
        <AdminSummaryCard label="Regras Ativas" value={regrasAtivas} />
        <AdminSummaryCard label="Regras Inativas" value={regrasInativas} />
      </div>

      <section className="rounded-[24px] border border-[#dbe3ef] bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-black tracking-[-0.02em] text-[#0f172a]">Regras rápidas (presets)</h2>
            <p className="text-[13px] text-[#64748b]">
              Escolha um preset pronto e ajuste só template, canal e ativação automática.
            </p>
          </div>
          <button
            onClick={abrirCriarAvancado}
            className="rounded-full border border-[#dbe3ef] px-4 py-2 text-[12px] font-bold text-[#475569] hover:bg-gray-50"
          >
            + Regra avançada
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {QUICK_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => abrirCriarPreset(preset.id)}
              className="rounded-[18px] border border-[#dbe3ef] bg-[#fafaff] p-4 text-left transition hover:border-violet-300 hover:bg-violet-50"
            >
              <div className="text-[14px] font-bold text-[#0f172a]">{preset.title}</div>
              <div className="mt-1 text-[12px] leading-5 text-[#64748b]">{preset.subtitle}</div>
              <div className="mt-3 text-[11px] font-bold uppercase tracking-wide text-violet-600">
                {preset.triggerType === 'instant' ? 'Gatilho instantâneo' : 'Gatilho programado'}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-[#dbe3ef] bg-white p-5">
        <h2 className="text-[18px] font-black tracking-[-0.02em] text-[#0f172a]">Automático + manual</h2>
        <p className="mt-1 text-[14px] leading-6 text-[#64748b]">
          Regras controlam disparos automáticos. O envio manual continua disponível para reenviar convite,
          disparar templates sob demanda e agir fora dos gatilhos.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[16px] font-black tracking-[-0.02em] text-[#0f172a]">Gatilhos instantâneos</h2>
        {regrasInstantaneas.length === 0 && (
          <div className="rounded-[16px] border border-dashed border-[#dbe3ef] bg-white p-5 text-[14px] text-[#64748b]">
            Nenhuma regra instantânea criada ainda.
          </div>
        )}
        {regrasInstantaneas.map((regra) => {
          const preset = getPresetFromRule(regra);
          return (
            <div key={regra.id} className="rounded-[20px] border border-[#dbe3ef] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] font-black tracking-[-0.02em] text-[#0f172a]">{regra.name}</span>
                    <StatusBadge isActive={regra.is_active} />
                  </div>
                  <div className="text-[12px] text-[#64748b]">{getEventLabel(regra.event_type)} • {getRecipientLabel(regra.recipient_type)}</div>
                  {regra.template && (
                    <div className="text-[12px] text-[#64748b]">Template: {regra.template.name}</div>
                  )}
                  {regra.channel && (
                    <div className="text-[12px] text-[#64748b]">Canal: {regra.channel.name}</div>
                  )}
                  <div className="text-[11px] text-[#94a3b8]">Atualizado em {formatarData(regra.updated_at || regra.created_at)}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleAtivo(regra)}
                    className="rounded-full bg-gray-100 px-3 py-1.5 text-[12px] font-bold text-gray-700 hover:bg-gray-200"
                  >
                    {regra.is_active ? 'Desativar auto' : 'Ativar auto'}
                  </button>
                  <button
                    onClick={() => abrirEditar(regra, preset ? 'quick' : 'advanced')}
                    className="rounded-full bg-violet-100 px-3 py-1.5 text-[12px] font-bold text-violet-700 hover:bg-violet-200"
                  >
                    {preset ? 'Editar rápido' : 'Editar'}
                  </button>
                  {preset && (
                    <button
                      onClick={() => abrirEditar(regra, 'advanced')}
                      className="rounded-full border border-[#dbe3ef] px-3 py-1.5 text-[12px] font-bold text-[#64748b] hover:bg-gray-50"
                    >
                      Avançado
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-[16px] font-black tracking-[-0.02em] text-[#0f172a]">Gatilhos programados</h2>
        {regrasProgramadas.length === 0 && (
          <div className="rounded-[16px] border border-dashed border-[#dbe3ef] bg-white p-5 text-[14px] text-[#64748b]">
            Nenhuma regra programada criada ainda.
          </div>
        )}
        {regrasProgramadas.map((regra) => (
          <div key={regra.id} className="rounded-[20px] border border-[#dbe3ef] bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[16px] font-black tracking-[-0.02em] text-[#0f172a]">{regra.name}</span>
                  <StatusBadge isActive={regra.is_active} />
                </div>
                <div className="text-[12px] text-[#64748b]">{getEventLabel(regra.event_type)} • {getRecipientLabel(regra.recipient_type)}</div>
                <div className="text-[12px] text-[#64748b]">
                  {regra.days_before != null && <span className="mr-3">{regra.days_before} dias antes</span>}
                  {regra.days_after != null && <span className="mr-3">{regra.days_after} dias depois</span>}
                  {regra.send_time && <span>às {regra.send_time}</span>}
                </div>
                <div className="text-[11px] text-[#94a3b8]">Atualizado em {formatarData(regra.updated_at || regra.created_at)}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleAtivo(regra)}
                  className="rounded-full bg-gray-100 px-3 py-1.5 text-[12px] font-bold text-gray-700 hover:bg-gray-200"
                >
                  {regra.is_active ? 'Desativar auto' : 'Ativar auto'}
                </button>
                <button
                  onClick={() => abrirEditar(regra, 'advanced')}
                  className="rounded-full bg-violet-100 px-3 py-1.5 text-[12px] font-bold text-violet-700 hover:bg-violet-200"
                >
                  Editar
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center">
          <div className="w-full max-w-2xl rounded-[24px] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-2">
              <h2 className="text-[18px] font-black tracking-[-0.02em] text-[#0f172a]">
                {modalModo === 'quick' ? 'Configuração rápida' : 'Configuração avançada'}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setModalModo('quick')}
                  className={`rounded-full px-3 py-1 text-[12px] font-bold ${
                    modalModo === 'quick' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Rápida
                </button>
                <button
                  onClick={() => setModalModo('advanced')}
                  className={`rounded-full px-3 py-1 text-[12px] font-bold ${
                    modalModo === 'advanced' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Avançada
                </button>
              </div>
            </div>

            {modalModo === 'quick' ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-[#64748b]">Preset</label>
                  <select
                    value={quickForm.presetId}
                    onChange={(e) => {
                      const preset = QUICK_PRESETS.find((item) => item.id === e.target.value);
                      setQuickForm((prev) => ({
                        ...prev,
                        presetId: e.target.value,
                        days_before: preset?.days_before ?? '',
                        days_after: preset?.days_after ?? '',
                        send_time: preset?.send_time ?? '',
                      }));
                    }}
                    className="w-full rounded-[12px] border border-[#dbe3ef] px-4 py-2.5 text-[14px]"
                  >
                    <option value="">Selecione um preset</option>
                    {QUICK_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between rounded-[12px] border border-[#dbe3ef] px-4 py-3">
                  <span className="text-[14px] font-bold text-[#0f172a]">Ativar regra</span>
                  <button
                    type="button"
                    onClick={() => setQuickForm((f) => ({ ...f, is_active: !f.is_active }))}
                    className={`relative h-6 w-11 rounded-full ${quickForm.is_active ? 'bg-violet-600' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${quickForm.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <div>
                  <label className="mb-1 block text-[12px] font-bold text-[#64748b]">Template da mensagem</label>
                  <select
                    value={quickForm.template_id}
                    onChange={(e) => setQuickForm((f) => ({ ...f, template_id: e.target.value }))}
                    className="w-full rounded-[12px] border border-[#dbe3ef] px-4 py-2.5 text-[14px]"
                  >
                    <option value="">Sem template (usar padrão do sistema)</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[12px] font-bold text-[#64748b]">Canal de envio</label>
                  <select
                    value={quickForm.channel_id}
                    onChange={(e) => setQuickForm((f) => ({ ...f, channel_id: e.target.value }))}
                    className="w-full rounded-[12px] border border-[#dbe3ef] px-4 py-2.5 text-[14px]"
                  >
                    <option value="">Sem canal (usar padrão/env vars)</option>
                    {canais.map((canal) => (
                      <option key={canal.id} value={canal.id}>
                        {canal.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between rounded-[12px] border border-[#dbe3ef] px-4 py-3">
                  <span className="text-[14px] font-bold text-[#0f172a]">
                    {presetSelecionado?.autoSendLabel || 'Enviar automaticamente ao ocorrer o gatilho?'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuickForm((f) => ({ ...f, auto_send: !f.auto_send }))}
                    className={`relative h-6 w-11 rounded-full ${quickForm.auto_send ? 'bg-violet-600' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${quickForm.auto_send ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-[12px] border border-[#dbe3ef] px-4 py-3">
                  <span className="text-[14px] font-bold text-[#0f172a]">Manter envio manual disponível?</span>
                  <button
                    type="button"
                    onClick={() => setQuickForm((f) => ({ ...f, manual_enabled: !f.manual_enabled }))}
                    className={`relative h-6 w-11 rounded-full ${quickForm.manual_enabled ? 'bg-emerald-600' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${quickForm.manual_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <p className="text-[12px] text-[#64748b]">
                  O envio manual permanece disponível no produto para reenvios e disparos sob demanda,
                  independentemente da automação.
                </p>

                {presetSelecionado?.triggerType === 'scheduled' && (
                  <div className="grid grid-cols-3 gap-3 rounded-[12px] border border-[#dbe3ef] p-3">
                    <div>
                      <label className="mb-1 block text-[12px] font-bold text-[#64748b]">Dias antes</label>
                      <input
                        type="number"
                        value={quickForm.days_before}
                        onChange={(e) => setQuickForm((f) => ({ ...f, days_before: e.target.value }))}
                        className="w-full rounded-[10px] border border-[#dbe3ef] px-3 py-2 text-[14px]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[12px] font-bold text-[#64748b]">Dias depois</label>
                      <input
                        type="number"
                        value={quickForm.days_after}
                        onChange={(e) => setQuickForm((f) => ({ ...f, days_after: e.target.value }))}
                        className="w-full rounded-[10px] border border-[#dbe3ef] px-3 py-2 text-[14px]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[12px] font-bold text-[#64748b]">Horário</label>
                      <input
                        type="time"
                        step="60"
                        value={quickForm.send_time}
                        onChange={(e) => setQuickForm((f) => ({ ...f, send_time: e.target.value }))}
                        className="w-full rounded-[10px] border border-[#dbe3ef] px-3 py-2 text-[14px]"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-[#64748b]">Nome *</label>
                    <input
                      type="text"
                      value={advancedForm.name}
                      onChange={(e) => setAdvancedForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-[12px] border border-[#dbe3ef] px-4 py-2.5 text-[14px]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-[#64748b]">Key *</label>
                    <input
                      type="text"
                      value={advancedForm.key}
                      onChange={(e) =>
                        setAdvancedForm((f) => ({
                          ...f,
                          key: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                        }))
                      }
                      className="w-full rounded-[12px] border border-[#dbe3ef] px-4 py-2.5 font-mono text-[13px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-[#64748b]">Tipo de evento *</label>
                    <select
                      value={advancedForm.event_type}
                      onChange={(e) => setAdvancedForm((f) => ({ ...f, event_type: e.target.value }))}
                      className="w-full rounded-[12px] border border-[#dbe3ef] px-4 py-2.5 text-[14px]"
                    >
                      <option value="">Selecione</option>
                      {EVENT_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-[#64748b]">Destinatário *</label>
                    <select
                      value={advancedForm.recipient_type}
                      onChange={(e) =>
                        setAdvancedForm((f) => ({ ...f, recipient_type: e.target.value }))
                      }
                      className="w-full rounded-[12px] border border-[#dbe3ef] px-4 py-2.5 text-[14px]"
                    >
                      <option value="">Selecione</option>
                      {RECIPIENT_TYPES.map((recipient) => (
                        <option key={recipient.value} value={recipient.value}>
                          {recipient.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-[#64748b]">Template</label>
                    <select
                      value={advancedForm.template_id}
                      onChange={(e) => setAdvancedForm((f) => ({ ...f, template_id: e.target.value }))}
                      className="w-full rounded-[12px] border border-[#dbe3ef] px-4 py-2.5 text-[14px]"
                    >
                      <option value="">Sem template</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-[#64748b]">Canal</label>
                    <select
                      value={advancedForm.channel_id}
                      onChange={(e) => setAdvancedForm((f) => ({ ...f, channel_id: e.target.value }))}
                      className="w-full rounded-[12px] border border-[#dbe3ef] px-4 py-2.5 text-[14px]"
                    >
                      <option value="">Sem canal</option>
                      {canais.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 rounded-[12px] border border-[#dbe3ef] p-3">
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-[#64748b]">Dias antes</label>
                    <input
                      type="number"
                      value={advancedForm.days_before}
                      onChange={(e) => setAdvancedForm((f) => ({ ...f, days_before: e.target.value }))}
                      className="w-full rounded-[10px] border border-[#dbe3ef] px-3 py-2 text-[14px]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-[#64748b]">Dias depois</label>
                    <input
                      type="number"
                      value={advancedForm.days_after}
                      onChange={(e) => setAdvancedForm((f) => ({ ...f, days_after: e.target.value }))}
                      className="w-full rounded-[10px] border border-[#dbe3ef] px-3 py-2 text-[14px]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-[#64748b]">Horário</label>
                    <input
                      type="time"
                      step="60"
                      value={advancedForm.send_time}
                      onChange={(e) => setAdvancedForm((f) => ({ ...f, send_time: e.target.value }))}
                      className="w-full rounded-[10px] border border-[#dbe3ef] px-3 py-2 text-[14px]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-[12px] border border-[#dbe3ef] px-4 py-3">
                  <span className="text-[14px] font-bold text-[#0f172a]">Regra ativa</span>
                  <button
                    type="button"
                    onClick={() => setAdvancedForm((f) => ({ ...f, is_active: !f.is_active }))}
                    className={`relative h-6 w-11 rounded-full ${advancedForm.is_active ? 'bg-violet-600' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${advancedForm.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={fecharModal}
                className="flex-1 rounded-full border border-[#dbe3ef] px-4 py-2.5 text-[13px] font-bold text-[#64748b] hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={modalModo === 'quick' ? salvarQuick : salvarAvancado}
                disabled={salvando}
                className="flex-1 rounded-full bg-violet-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-violet-700 disabled:opacity-60"
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
