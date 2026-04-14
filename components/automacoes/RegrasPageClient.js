'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import AutomationBackLink from '@/components/automacoes/AutomationBackLink';

const EVENT_TYPES = [
  { value: 'invite_member', label: 'Convite de escala (membro)' },
  { value: 'schedule_no_response_member', label: 'Lembrete de não resposta (membro)' },
  { value: 'member_declined_admin', label: 'Membro recusou (admin)' },
  { value: 'schedule_incomplete_admin', label: 'Escala incompleta (admin)' },
  { value: 'contract_sent_client', label: 'Contrato enviado (cliente)' },
  { value: 'contract_signed_client', label: 'Contrato assinado (cliente)' },
  { value: 'contract_signature_reminder_client', label: 'Lembrete de assinatura (cliente)' },
  { value: 'repertoire_request_client', label: 'Solicitar repertório (cliente)' },
  { value: 'repertoire_pending_15_days_client', label: 'Lembrete de repertório (cliente)' },
  { value: 'repertoire_finalized_client', label: 'Repertório finalizado (cliente)' },
  { value: 'payment_pending_2_days_client', label: 'Lembrete de pagamento (cliente)' },
  { value: 'payment_confirmed_client', label: 'Confirmação de pagamento (cliente)' },
  { value: 'pre_event_reminder_client', label: 'Lembrete pré-evento (cliente)' },
  { value: 'post_event_review_request_client', label: 'Pós-evento (cliente)' },
  { value: 'admin_internal_notification', label: 'Notificação interna (admin)' },
  { value: 'admin_critical_failure', label: 'Falha crítica (admin)' },
  { value: 'schedule_pending_15_days_admin', label: 'Escala com risco (admin)' },
];

const RECIPIENT_TYPES = [
  { value: 'client', label: 'Cliente' },
  { value: 'member', label: 'Membro' },
  { value: 'admin', label: 'Admin' },
  { value: 'financial', label: 'Financeiro' },
];

const QUICK_SECTIONS = [
  {
    id: 'escala',
    title: 'Escala',
    description: 'Automatize convites, lembretes e alertas da equipe.',
    presets: [
      {
        id: 'invite_member',
        key: 'convite_escala_rapido',
        name: 'Convite de escala ao salvar escala',
        title: 'Convite de escala',
        subtitle: 'Envia convite ao salvar escala',
        event_type: 'invite_member',
        recipient_type: 'member',
        triggerType: 'instant',
        badge: 'Instantâneo',
        autoSendLabel: 'Enviar automaticamente ao salvar escala?',
        modalTitle: 'Configurar convite de escala',
        modalSubtitle:
          'Defina como o sistema deve convidar os músicos ao salvar a escala.',
        showManualAction: true,
      },
      {
        id: 'schedule_no_response_member',
        key: 'lembrete_nao_resposta_rapido',
        name: 'Lembrete de não resposta',
        title: 'Lembrete de não resposta',
        subtitle: 'Lembra músicos que ainda não responderam',
        event_type: 'schedule_no_response_member',
        recipient_type: 'member',
        triggerType: 'scheduled',
        badge: 'Programado',
        days_after: 2,
        send_time: '09:00',
      },
      {
        id: 'member_declined_admin',
        key: 'aviso_recusa_rapido',
        name: 'Aviso de recusa',
        title: 'Aviso de recusa',
        subtitle: 'Notifica admin quando um músico recusa',
        event_type: 'member_declined_admin',
        recipient_type: 'admin',
        triggerType: 'instant',
        badge: 'Instantâneo',
      },
      {
        id: 'schedule_incomplete_admin',
        key: 'escala_incompleta_rapido',
        name: 'Escala incompleta',
        title: 'Escala incompleta',
        subtitle: 'Alerta quando faltam músicos perto do evento',
        event_type: 'schedule_incomplete_admin',
        recipient_type: 'admin',
        triggerType: 'scheduled',
        badge: 'Programado',
        days_before: 1,
        send_time: '10:00',
      },
    ],
  },
  {
    id: 'contratos',
    title: 'Contratos',
    description: 'Automatize envio, assinatura e lembretes.',
    presets: [
      {
        id: 'contract_sent_client',
        key: 'contrato_enviado_rapido',
        name: 'Contrato enviado',
        title: 'Contrato enviado',
        subtitle: 'Dispara confirmação quando o contrato é enviado',
        event_type: 'contract_sent_client',
        recipient_type: 'client',
        triggerType: 'instant',
        badge: 'Instantâneo',
      },
      {
        id: 'contract_signed_client',
        key: 'contrato_assinado_rapido',
        name: 'Contrato assinado',
        title: 'Contrato assinado',
        subtitle: 'Contrato assinado → enviar mensagem',
        event_type: 'contract_signed_client',
        recipient_type: 'client',
        triggerType: 'instant',
        badge: 'Instantâneo',
      },
      {
        id: 'contract_signature_reminder_client',
        key: 'contrato_lembrete_assinatura_rapido',
        name: 'Lembrete de assinatura',
        title: 'Lembrete de assinatura',
        subtitle: 'Reforça assinatura pendente no prazo definido',
        event_type: 'contract_signature_reminder_client',
        recipient_type: 'client',
        triggerType: 'scheduled',
        badge: 'Programado',
        days_after: 2,
        send_time: '10:00',
      },
    ],
  },
  {
    id: 'repertorio',
    title: 'Repertório',
    description: 'Automatize solicitação, lembretes e fechamento musical.',
    presets: [
      {
        id: 'repertoire_request_client',
        key: 'solicitar_repertorio_rapido',
        name: 'Solicitar repertório',
        title: 'Solicitar repertório',
        subtitle: 'Solicita repertório ao cliente no momento ideal',
        event_type: 'repertoire_request_client',
        recipient_type: 'client',
        triggerType: 'instant',
        badge: 'Instantâneo',
      },
      {
        id: 'repertoire_pending_15_days_client',
        key: 'lembrete_repertorio_rapido',
        name: 'Lembrete de repertório',
        title: 'Lembrete de repertório',
        subtitle: 'Lembra cliente sobre repertório pendente',
        event_type: 'repertoire_pending_15_days_client',
        recipient_type: 'client',
        triggerType: 'scheduled',
        badge: 'Programado',
        days_before: 15,
        send_time: '09:00',
      },
      {
        id: 'repertoire_finalized_client',
        key: 'repertorio_finalizado_rapido',
        name: 'Repertório finalizado',
        title: 'Repertório finalizado',
        subtitle: 'Envia link/PDF ao finalizar repertório',
        event_type: 'repertoire_finalized_client',
        recipient_type: 'client',
        triggerType: 'instant',
        badge: 'Instantâneo',
      },
    ],
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    description: 'Automatize cobrança, aviso de saldo e confirmação.',
    presets: [
      {
        id: 'payment_pending_2_days_client',
        key: 'lembrete_pagamento_rapido',
        name: 'Lembrete de pagamento',
        title: 'Lembrete de pagamento',
        subtitle: 'Notifica saldo pendente antes do evento',
        event_type: 'payment_pending_2_days_client',
        recipient_type: 'financial',
        triggerType: 'scheduled',
        badge: 'Programado',
        days_before: 2,
        send_time: '10:00',
      },
      {
        id: 'payment_confirmed_client',
        key: 'confirmacao_pagamento_rapido',
        name: 'Confirmação de pagamento',
        title: 'Confirmação de pagamento',
        subtitle: 'Confirma quando o pagamento é compensado',
        event_type: 'payment_confirmed_client',
        recipient_type: 'client',
        triggerType: 'instant',
        badge: 'Instantâneo',
      },
    ],
  },
  {
    id: 'evento',
    title: 'Evento',
    description: 'Mensagens úteis antes e depois do evento.',
    presets: [
      {
        id: 'pre_event_reminder_client',
        key: 'lembrete_pre_evento_rapido',
        name: 'Lembrete pré-evento',
        title: 'Lembrete pré-evento',
        subtitle: 'Envia detalhes finais antes do evento',
        event_type: 'pre_event_reminder_client',
        recipient_type: 'client',
        triggerType: 'scheduled',
        badge: 'Programado',
        days_before: 1,
        send_time: '12:00',
      },
      {
        id: 'post_event_review_request_client',
        key: 'pos_evento_rapido',
        name: 'Pedido de avaliação pós-evento',
        title: 'Pedido de avaliação pós-evento',
        subtitle: 'Solicita avaliação no timing pós-evento',
        event_type: 'post_event_review_request_client',
        recipient_type: 'client',
        triggerType: 'scheduled',
        badge: 'Programado',
        delay_hours: 24,
        send_time: '10:00',
        showManualAction: true,
      },
    ],
  },
  {
    id: 'admin',
    title: 'Admin',
    description: 'Receba avisos internos e notificações operacionais.',
    presets: [
      {
        id: 'admin_internal_notification',
        key: 'admin_notificacao_interna_rapido',
        name: 'Notificação interna',
        title: 'Notificação interna',
        subtitle: 'Notifica equipe interna sobre eventos operacionais',
        event_type: 'admin_internal_notification',
        recipient_type: 'admin',
        triggerType: 'instant',
        badge: 'Instantâneo',
      },
      {
        id: 'admin_critical_failure',
        key: 'admin_falha_critica_rapido',
        name: 'Falha crítica',
        title: 'Falha crítica',
        subtitle: 'Alerta imediatamente em falhas críticas',
        event_type: 'admin_critical_failure',
        recipient_type: 'admin',
        triggerType: 'instant',
        badge: 'Instantâneo',
      },
      {
        id: 'schedule_pending_15_days_admin',
        key: 'escala_risco_rapido',
        name: 'Escala com risco',
        title: 'Escala com risco',
        subtitle: 'Avisa quando existem convites pendentes críticos',
        event_type: 'schedule_pending_15_days_admin',
        recipient_type: 'admin',
        triggerType: 'scheduled',
        badge: 'Programado',
        days_before: 15,
        send_time: '09:00',
      },
    ],
  },
];

const QUICK_PRESETS = QUICK_SECTIONS.flatMap((section) => section.presets);

const ADVANCED_FORM = {
  key: '',
  name: '',
  event_type: '',
  recipient_type: '',
  template_id: '',
  channel_id: '',
  days_before: '',
  days_after: '',
  delay_hours: '',
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
  delay_hours: '',
  send_time: '',
};

const MANUAL_FORM = {
  eventType: 'invite_member',
  entityId: '',
  template_id: '',
  channel_id: '',
  recipient: '',
};

const PREVIEW_VARS = {
  '{cliente_nome}': 'Ana Paula',
  '{evento_nome}': 'Casamento Ana & Lucas',
  '{evento_data}': '20/09/2026',
  '{evento_horario}': '19h00',
  '{evento_local}': 'Espaço Villa Verde',
  '{link_escala}': 'https://harmonics.app/escalas/convite-demo',
  '{link_repertorio}': 'https://harmonics.app/repertorio/demo',
  '{link_contrato}': 'https://harmonics.app/contrato/demo',
  '{link_review}': 'https://harmonics.app/cliente/token-demo/review',
  '{review_link}': 'https://harmonics.app/cliente/token-demo/review',
  '{saldo_pendente}': 'R$ 1.500,00',
};

function replaceVars(body = '', vars = PREVIEW_VARS) {
  let output = body;
  for (const [key, value] of Object.entries(vars)) {
    output = output.replaceAll(key, value);
  }
  return output;
}

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

function isScheduledRule(rule) {
  return (
    rule.days_before != null ||
    rule.days_after != null ||
    rule.delay_hours != null ||
    Boolean(rule.send_time)
  );
}

function getPresetFromRule(rule) {
  return QUICK_PRESETS.find(
    (preset) => preset.event_type === rule.event_type && preset.recipient_type === rule.recipient_type
  );
}

function getEventLabel(eventType) {
  return EVENT_TYPES.find((e) => e.value === eventType)?.label || eventType;
}

function getRecipientLabel(recipientType) {
  return RECIPIENT_TYPES.find((r) => r.value === recipientType)?.label || recipientType;
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

function ToggleField({ label, value, onChange, tone = 'violet' }) {
  const toneClass = tone === 'emerald' ? 'bg-emerald-500' : 'bg-violet-600';
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <span className="text-sm font-bold text-slate-900">{label}</span>
      <button
        type="button"
        onClick={onChange}
        className={classNames('relative h-6 w-11 rounded-full transition', value ? toneClass : 'bg-slate-300')}
      >
        <span
          className={classNames(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
            value ? 'translate-x-5' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );
}

export default function RegrasPageClient() {
  const [regras, setRegras] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [canais, setCanais] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [visao, setVisao] = useState('quick');

  const [editandoId, setEditandoId] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalModo, setModalModo] = useState('quick');
  const [salvando, setSalvando] = useState(false);
  const [advancedForm, setAdvancedForm] = useState(ADVANCED_FORM);
  const [quickForm, setQuickForm] = useState(QUICK_FORM);

  const [manualModalAberto, setManualModalAberto] = useState(false);
  const [manualForm, setManualForm] = useState(MANUAL_FORM);
  const [enviandoManual, setEnviandoManual] = useState(false);

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

  const regrasAtivas = useMemo(() => regras.filter((r) => r.is_active), [regras]);
  const gatilhosInstantaneos = useMemo(() => regras.filter((r) => !isScheduledRule(r)), [regras]);
  const gatilhosProgramados = useMemo(() => regras.filter((r) => isScheduledRule(r)), [regras]);
  const rulesByPreset = useMemo(() => {
    const map = new Map();
    for (const rule of regras) {
      const preset = getPresetFromRule(rule);
      if (preset) map.set(preset.id, rule);
    }
    return map;
  }, [regras]);

  function abrirCriarPreset(presetId) {
    const preset = QUICK_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

    const regraExistente = rulesByPreset.get(preset.id);
    if (regraExistente) {
      abrirEditar(regraExistente, 'quick');
      return;
    }

    setEditandoId(null);
    setModalModo('quick');
    setQuickForm({
      ...QUICK_FORM,
      presetId: preset.id,
      days_before: preset.days_before ?? '',
      days_after: preset.days_after ?? '',
      delay_hours: preset.delay_hours ?? '',
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
        delay_hours: regra.delay_hours ?? preset.delay_hours ?? '',
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
        delay_hours: regra.delay_hours ?? '',
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
        delay_hours:
          preset.triggerType === 'scheduled' && quickForm.delay_hours !== ''
            ? Number(quickForm.delay_hours)
            : null,
        send_time: preset.triggerType === 'scheduled' ? quickForm.send_time || null : null,
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
    if (!advancedForm.key || !advancedForm.name || !advancedForm.event_type || !advancedForm.recipient_type) {
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
        days_before: advancedForm.days_before !== '' ? Number(advancedForm.days_before) : null,
        days_after: advancedForm.days_after !== '' ? Number(advancedForm.days_after) : null,
        delay_hours: advancedForm.delay_hours !== '' ? Number(advancedForm.delay_hours) : null,
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

  async function desativarRegraEmEdicao() {
    if (!editandoId) {
      setQuickForm((prev) => ({ ...prev, is_active: false, auto_send: false }));
      return;
    }

    setSalvando(true);
    try {
      const response = await fetch(`/api/automation/rules/${editandoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao desativar regra');

      await carregarDados();
      fecharModal();
    } catch (error) {
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

  async function enviarTeste(preset) {
    setManualForm((prev) => ({ ...prev, eventType: preset.event_type }));
    setManualModalAberto(true);
  }

  async function enviarManualAgora() {
    if (!manualForm.eventType || !manualForm.entityId) {
      alert('Para enviar agora, informe o gatilho e o ID da entidade.');
      return;
    }

    try {
      setEnviandoManual(true);
      const response = await fetch('/api/automation/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: manualForm.eventType,
          entityId: manualForm.entityId,
          template_id: manualForm.template_id || null,
          channel_id: manualForm.channel_id || null,
          recipient: manualForm.recipient || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao disparar envio manual');
      alert(`Envio manual processado. Sent: ${data.sent ?? 0}, skipped: ${data.skipped ?? 0}`);
      setManualModalAberto(false);
      setManualForm(MANUAL_FORM);
    } catch (error) {
      alert(error.message);
    } finally {
      setEnviandoManual(false);
    }
  }

  if (carregando) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
          <div className="mt-3 h-10 w-72 animate-pulse rounded bg-slate-100" />
          <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-slate-100" />
        </section>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
        <div className="text-base font-bold text-red-700">Erro ao carregar regras</div>
        <div className="mt-1 text-sm text-red-600">{erro}</div>
        <button
          onClick={carregarDados}
          className="mt-4 rounded-full bg-red-100 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-200"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const presetSelecionado = QUICK_PRESETS.find((preset) => preset.id === quickForm.presetId);
  const templateSelecionado = templates.find((item) => item.id === quickForm.template_id);
  const previewMensagem = replaceVars(
    templateSelecionado?.body ||
      'Olá {cliente_nome}, sua escala para {evento_nome} foi salva. Confira os detalhes no link: {link_escala}'
  );

  return (
    <div className="space-y-6 pb-8">
      <AutomationBackLink />

      <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
        <div className="text-xs font-bold uppercase tracking-[0.22em] text-violet-600">AUTOMAÇÃO</div>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Regras rápidas</h1>
        <p className="mt-3 max-w-3xl text-base text-slate-500">
          Ative automações prontas para contratos, escalas, repertórios e financeiro sem precisar configurar lógica técnica.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={abrirCriarAvancado} className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700">
            Nova regra avançada
          </button>
          <Link href="/automacoes/templates" className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
            Ver templates
          </Link>
          <Link href="/automacoes/logs" className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
            Ver logs
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Regras ativas</div>
          <div className="mt-2 text-3xl font-black tracking-tight text-slate-900">{regrasAtivas.length}</div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">Gatilhos instantâneos</div>
          <div className="mt-2 text-3xl font-black tracking-tight text-emerald-900">{gatilhosInstantaneos.length}</div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700">Gatilhos programados</div>
          <div className="mt-2 text-3xl font-black tracking-tight text-amber-900">{gatilhosProgramados.length}</div>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-sky-700">Envio manual disponível</div>
          <div className="mt-2 text-sm font-bold text-sky-900">Sempre ativo para disparos sob demanda</div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setVisao('quick')}
            className={classNames(
              'rounded-xl px-4 py-2.5 text-sm font-bold',
              visao === 'quick' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700'
            )}
          >
            Regras rápidas
          </button>
          <button
            onClick={() => setVisao('advanced')}
            className={classNames(
              'rounded-xl px-4 py-2.5 text-sm font-bold',
              visao === 'advanced' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700'
            )}
          >
            Modo avançado
          </button>
        </div>
      </section>

      {visao === 'quick' && (
        <div className="space-y-6">
          {QUICK_SECTIONS.map((section) => (
            <section key={section.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-slate-950">{section.title}</h2>
              <p className="mt-1 text-base text-slate-500">{section.description}</p>
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {section.presets.map((preset) => {
                  const regra = rulesByPreset.get(preset.id);
                  const templateName = regra?.template?.name || 'Padrão do sistema';
                  const channelName = regra?.channel?.name || 'Canal padrão';
                  const active = regra?.is_active || false;
                  return (
                    <article key={preset.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-black text-slate-900">{preset.title}</h3>
                          <p className="mt-1 text-sm text-slate-500">{preset.subtitle}</p>
                        </div>
                        <span
                          className={classNames(
                            'rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide',
                            preset.triggerType === 'instant'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          )}
                        >
                          {preset.badge}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-1 text-sm text-slate-600">
                        <div>Template: <span className="font-semibold text-slate-800">{templateName}</span></div>
                        <div>Canal: <span className="font-semibold text-slate-800">{channelName}</span></div>
                        <div>
                          Envio manual: <span className="font-semibold text-sky-700">permitido</span>
                        </div>
                        {isScheduledRule({ ...preset, ...regra }) && (
                          <div>
                            {regra?.days_before != null || preset.days_before != null ? `Dias antes: ${regra?.days_before ?? preset.days_before}` : ''}
                            {regra?.days_after != null || preset.days_after != null ? ` ${regra?.days_after ?? preset.days_after} dias depois` : ''}
                            {regra?.delay_hours != null || preset.delay_hours != null ? ` Atraso: ${regra?.delay_hours ?? preset.delay_hours}h` : ''}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button onClick={() => abrirCriarPreset(preset.id)} className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-200">
                          Configurar
                        </button>
                        <button onClick={() => enviarTeste(preset)} className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                          Testar
                        </button>
                        {preset.showManualAction && (
                          <button
                            onClick={() => {
                              setManualForm((prev) => ({ ...prev, eventType: preset.event_type }));
                              setManualModalAberto(true);
                            }}
                            className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700"
                          >
                            Enviar manualmente
                          </button>
                        )}
                        <button
                          onClick={() => regra && toggleAtivo(regra)}
                          disabled={!regra}
                          className={classNames(
                            'rounded-full px-3 py-1.5 text-xs font-bold',
                            active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
                            !regra && 'opacity-50'
                          )}
                        >
                          {active ? 'Ativo' : 'Inativo'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}

          <section className="rounded-3xl border border-sky-200 bg-sky-50 p-6">
            <h2 className="text-2xl font-black text-slate-950">Enviar agora</h2>
            <p className="mt-1 text-base text-slate-500">Dispare uma mensagem manualmente quando precisar.</p>
            <button
              onClick={() => setManualModalAberto(true)}
              className="mt-4 rounded-full bg-sky-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-700"
            >
              Novo envio manual
            </button>
          </section>
        </div>
      )}

      {visao === 'advanced' && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-slate-950">Modo avançado</h2>
              <p className="text-sm text-slate-500">Acesso completo ao motor técnico atual, sem alterações de compatibilidade.</p>
            </div>
            <button onClick={abrirCriarAvancado} className="rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white">
              Nova regra avançada
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Regra</th>
                  <th className="px-4 py-3">Evento</th>
                  <th className="px-4 py-3">Destinatário</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Atualização</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {regras.map((regra) => (
                  <tr key={regra.id} className="border-t border-slate-200">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{regra.name}</div>
                      <div className="text-xs text-slate-500">{regra.key}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{getEventLabel(regra.event_type)}</td>
                    <td className="px-4 py-3 text-slate-700">{getRecipientLabel(regra.recipient_type)}</td>
                    <td className="px-4 py-3">
                      <span className={classNames('rounded-full px-3 py-1 text-xs font-bold', isScheduledRule(regra) ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>
                        {isScheduledRule(regra) ? 'Programado' : 'Instantâneo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatarData(regra.updated_at || regra.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => toggleAtivo(regra)} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700">
                          {regra.is_active ? 'Desativar' : 'Ativar'}
                        </button>
                        <button onClick={() => abrirEditar(regra, 'advanced')} className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={fecharModal}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {modalModo === 'quick' ? (
              <>
                <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-6 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.22em] text-violet-600">Configuração rápida</div>
                      <h2 className="mt-1 text-2xl font-black text-slate-950">
                        {presetSelecionado?.modalTitle || `Configurar ${presetSelecionado?.title || 'regra rápida'}`}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {presetSelecionado?.modalSubtitle || 'Ajuste template, canal e ativação sem formulário técnico complexo.'}
                      </p>
                    </div>
                    <button
                      onClick={fecharModal}
                      className="rounded-full border border-slate-200 px-3 py-1 text-sm font-bold text-slate-600"
                    >
                      Fechar
                    </button>
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-6 pr-2 pt-4">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Preset</label>
                    <select
                      value={quickForm.presetId}
                      onChange={(e) => {
                        const preset = QUICK_PRESETS.find((item) => item.id === e.target.value);
                        setQuickForm((prev) => ({
                          ...prev,
                          presetId: e.target.value,
                          days_before: preset?.days_before ?? '',
                          days_after: preset?.days_after ?? '',
                          delay_hours: preset?.delay_hours ?? '',
                          send_time: preset?.send_time ?? '',
                        }));
                      }}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                    >
                      <option value="">Selecione um preset</option>
                      {QUICK_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <ToggleField label="Ativar automação" value={quickForm.is_active} onChange={() => setQuickForm((f) => ({ ...f, is_active: !f.is_active }))} />

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Template da mensagem</label>
                      <select
                        value={quickForm.template_id}
                        onChange={(e) => setQuickForm((f) => ({ ...f, template_id: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                      >
                        <option value="">Sem template (usar padrão)</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Canal de envio</label>
                      <select
                        value={quickForm.channel_id}
                        onChange={(e) => setQuickForm((f) => ({ ...f, channel_id: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                      >
                        <option value="">Sem canal (usar padrão)</option>
                        {canais.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <ToggleField
                    label={presetSelecionado?.autoSendLabel || 'Enviar automaticamente ao ocorrer gatilho?'}
                    value={quickForm.auto_send}
                    onChange={() => setQuickForm((f) => ({ ...f, auto_send: !f.auto_send }))}
                  />

                  <ToggleField
                    label="Permitir envio manual também?"
                    value={quickForm.manual_enabled}
                    onChange={() => setQuickForm((f) => ({ ...f, manual_enabled: !f.manual_enabled }))}
                    tone="emerald"
                  />

                  {presetSelecionado?.triggerType === 'scheduled' && (
                    <div className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 md:grid-cols-4">
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-amber-700">Dias antes</label>
                        <input
                          type="number"
                          value={quickForm.days_before}
                          onChange={(e) => setQuickForm((f) => ({ ...f, days_before: e.target.value }))}
                          className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-amber-700">Dias depois</label>
                        <input
                          type="number"
                          value={quickForm.days_after}
                          onChange={(e) => setQuickForm((f) => ({ ...f, days_after: e.target.value }))}
                          className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-amber-700">Horário</label>
                        <input
                          type="time"
                          value={quickForm.send_time}
                          onChange={(e) => setQuickForm((f) => ({ ...f, send_time: e.target.value }))}
                          className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-amber-700">Atraso (horas)</label>
                        <input
                          type="number"
                          min="1"
                          value={quickForm.delay_hours}
                          onChange={(e) => setQuickForm((f) => ({ ...f, delay_hours: e.target.value }))}
                          className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Preview da mensagem</div>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{previewMensagem}</p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button onClick={fecharModal} className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700">
                    Cancelar
                  </button>
                  <button onClick={desativarRegraEmEdicao} className="rounded-full border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700">
                    Desativar
                  </button>
                  <button
                    onClick={salvarQuick}
                    disabled={salvando}
                    className="rounded-full bg-violet-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {salvando ? 'Salvando...' : 'Salvar configuração'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-6 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.22em] text-violet-600">Modo avançado</div>
                      <h2 className="mt-1 text-2xl font-black text-slate-950">Regra técnica</h2>
                    </div>
                    <button
                      onClick={fecharModal}
                      className="rounded-full border border-slate-200 px-3 py-1 text-sm font-bold text-slate-600"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-6 pr-2 pt-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input type="text" placeholder="Nome *" value={advancedForm.name} onChange={(e) => setAdvancedForm((f) => ({ ...f, name: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
                    <input type="text" placeholder="Key *" value={advancedForm.key} onChange={(e) => setAdvancedForm((f) => ({ ...f, key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <select value={advancedForm.event_type} onChange={(e) => setAdvancedForm((f) => ({ ...f, event_type: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                      <option value="">Tipo de evento *</option>
                      {EVENT_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                    <select value={advancedForm.recipient_type} onChange={(e) => setAdvancedForm((f) => ({ ...f, recipient_type: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                      <option value="">Destinatário *</option>
                      {RECIPIENT_TYPES.map((recipient) => (
                        <option key={recipient.value} value={recipient.value}>{recipient.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <select value={advancedForm.template_id} onChange={(e) => setAdvancedForm((f) => ({ ...f, template_id: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                      <option value="">Template</option>
                      {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <select value={advancedForm.channel_id} onChange={(e) => setAdvancedForm((f) => ({ ...f, channel_id: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                      <option value="">Canal</option>
                      {canais.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <input type="number" placeholder="Dias antes" value={advancedForm.days_before} onChange={(e) => setAdvancedForm((f) => ({ ...f, days_before: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
                    <input type="number" placeholder="Dias depois" value={advancedForm.days_after} onChange={(e) => setAdvancedForm((f) => ({ ...f, days_after: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
                    <input type="number" placeholder="Atraso (horas)" value={advancedForm.delay_hours} onChange={(e) => setAdvancedForm((f) => ({ ...f, delay_hours: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
                    <input type="time" value={advancedForm.send_time} onChange={(e) => setAdvancedForm((f) => ({ ...f, send_time: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
                  </div>

                  <ToggleField label="Regra ativa" value={advancedForm.is_active} onChange={() => setAdvancedForm((f) => ({ ...f, is_active: !f.is_active }))} />
                </div>

                <div className="mt-6 flex gap-2">
                  <button onClick={fecharModal} className="flex-1 rounded-full border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700">Cancelar</button>
                  <button onClick={salvarAvancado} disabled={salvando} className="flex-1 rounded-full bg-violet-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                    {salvando ? 'Salvando...' : 'Salvar regra'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {manualModalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setManualModalAberto(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-6 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.22em] text-sky-700">Enviar agora</div>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">Novo envio manual</h2>
                  <p className="mt-1 text-sm text-slate-500">Escolha template, destinatário e canal. Em seguida dispare manualmente.</p>
                </div>
                <button
                  onClick={() => setManualModalAberto(false)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-sm font-bold text-slate-600"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto px-6 pb-6 pr-2">
              <select value={manualForm.template_id} onChange={(e) => setManualForm((f) => ({ ...f, template_id: e.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                <option value="">Template (opcional)</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>

              <input
                type="text"
                value={manualForm.recipient}
                onChange={(e) => setManualForm((f) => ({ ...f, recipient: e.target.value }))}
                placeholder="Destinatário (telefone/e-mail de referência)"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />

              <select value={manualForm.channel_id} onChange={(e) => setManualForm((f) => ({ ...f, channel_id: e.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                <option value="">Canal (opcional)</option>
                {canais.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <select value={manualForm.eventType} onChange={(e) => setManualForm((f) => ({ ...f, eventType: e.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                {EVENT_TYPES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>

              <input
                type="text"
                value={manualForm.entityId}
                onChange={(e) => setManualForm((f) => ({ ...f, entityId: e.target.value }))}
                placeholder="ID da entidade (ex.: invite_id, event_id, contract_id)"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
            </div>

            <div className="mt-5 flex gap-2">
              <button onClick={() => setManualModalAberto(false)} className="flex-1 rounded-full border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700">Cancelar</button>
              <button onClick={enviarManualAgora} disabled={enviandoManual} className="flex-1 rounded-full bg-sky-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                {enviandoManual ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
