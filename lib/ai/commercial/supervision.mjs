/**
 * Fechamento supervisionado e autonomia progressiva (Manual §14, §20).
 *  - supervised (padrão): a IA prepara o pré-contrato (rascunho) e TODO link aguarda aprovação.
 *  - assisted: casos convencionais dentro das regras liberadas pelo Owner saem sozinhos.
 *  - autonomous: casos convencionais saem sozinhos; exceções continuam com o responsável.
 * A aprovação vale para a VERSÃO exata (hash do snapshot); mudança material exige nova aprovação.
 * O envio é idempotente por fechamento (chave closing-link:<id>).
 */
import { sha256Hex } from '../inbox/meta-webhook.mjs';
import { upsertPrecontract, linkMessage } from './closing.mjs';
import { buildPrecontractExpiresAt } from '../../contracts/precontract-expiration';

export const AUTONOMY_MODES = Object.freeze(['supervised', 'assisted', 'autonomous']);
const SNAPSHOT_FIELDS = ['id', 'status', 'event_date', 'event_time', 'event_type', 'formation', 'instruments', 'has_sound',
  'reception_hours', 'reception_formation', 'reception_instruments', 'base_amount', 'add_reception', 'add_sound',
  'add_transport', 'agreed_amount', 'contract_template_id', 'generated_link'];
const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function snapshotOf(precontract) {
  const out = {};
  for (const k of SNAPSHOT_FIELDS) {
    let v = precontract?.[k] ?? null;
    if (v instanceof Date) v = v.toISOString().slice(0, 10);
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && k === 'event_date') v = v.slice(0, 10);
    if (['base_amount', 'add_reception', 'add_sound', 'add_transport', 'agreed_amount', 'reception_hours'].includes(k) && v !== null) v = Number(v);
    out[k] = v;
  }
  delete out.status; // status muda no próprio envio; não é alteração material
  return out;
}

export async function approvalHashOf(closingId, snapshot) {
  return sha256Hex(`${closingId}:${JSON.stringify(snapshot)}`);
}

export async function resolveEventType({ supabase, workspaceId, lead = {} }) {
  const wanted = norm(lead.tipo_evento);
  if (!wanted) return null;
  const { data } = await supabase.from('event_types').select('id, name, is_active, default_contract_template_id').eq('workspace_id', workspaceId);
  const active = (data || []).filter((t) => t.is_active !== false);
  return active.find((t) => norm(t.name) === wanted) || active.find((t) => wanted.includes(norm(t.name)) || norm(t.name).includes(wanted)) || null;
}

/** Exceções que sempre exigem o responsável, em qualquer modo. */
export function exceptionReasons({ summary, eventType, templateId, reused, quoteApprovals = [] }) {
  const reasons = [];
  if (!eventType) reasons.push('event_type_unknown');
  if (!templateId) reasons.push('template_missing');
  if (reused) reasons.push('precontract_changed');
  if (quoteApprovals.length) reasons.push(...quoteApprovals.map((a) => `quote:${a}`));
  if (!summary?.time) reasons.push('ceremony_time_missing');
  if (!summary?.location) reasons.push('location_missing');
  return reasons;
}

export function autoSendAllowed({ mode, conventional, rules = {}, summary, eventType }) {
  if (!conventional || mode === 'supervised' || !AUTONOMY_MODES.includes(mode)) return false;
  if (mode === 'autonomous') return true;
  // assisted: só dentro das regras liberadas pelo Owner.
  const types = (rules.allowed_event_types || []).map(norm);
  const formations = (rules.allowed_formations || []).map(norm);
  if (!types.length && !formations.length && !Number(rules.max_total)) return false; // assistido sem regras = nada automático
  if (types.length && !types.includes(norm(eventType?.name))) return false;
  if (formations.length && !formations.includes(norm(summary?.ceremony?.formation))) return false;
  if (Number(rules.max_total) > 0 && Number(summary?.total) > Number(rules.max_total)) return false;
  if (rules.allow_reception === false && summary?.reception) return false;
  return true;
}

export const PREPARING_MESSAGE = 'Perfeito! ☺️ Já estou preparando o seu pré-contrato com esses dados e te envio o link por aqui assim que estiver pronto. 🎶';

/** Após a confirmação expressa: prepara o pré-contrato e decide entre fila de aprovação e envio. */
export async function prepareClosingForApproval({ supabase, workspaceId, conversation, closing, settings, env }) {
  const eventType = await resolveEventType({ supabase, workspaceId, lead: conversation.lead_data || {} });
  // Modelo correto = template padrão do tipo de evento (mesma regra do pré-contrato nativo).
  const templateId = eventType?.default_contract_template_id || null;
  const reused = Boolean(conversation.precontract_id);
  const pc = await upsertPrecontract({ supabase, workspaceId, conversation, summary: closing.summary, env, status: 'draft', eventType, templateId });
  if (!pc.ok) return { ok: false, reason: pc.reason };
  const { data: row } = await supabase.from('precontracts').select('*').eq('id', pc.precontractId).eq('workspace_id', workspaceId).maybeSingle();
  const snapshot = snapshotOf(row);
  const hash = await approvalHashOf(closing.id, snapshot);
  const reasons = exceptionReasons({ summary: closing.summary, eventType, templateId, reused, quoteApprovals: closing.summary?.quote_approvals || [] });
  await supabase.from('ai_closings').update({
    status: 'awaiting_approval', precontract_id: pc.precontractId, quote_id: pc.quoteId || null,
    prepared_snapshot: snapshot, approval_hash: hash, exception_reasons: reasons, conventional: reasons.length === 0,
    updated_at: new Date().toISOString(),
  }).eq('id', closing.id).eq('workspace_id', workspaceId);
  const mode = settings?.autonomy_mode || 'supervised';
  const auto = autoSendAllowed({ mode, conventional: reasons.length === 0, rules: settings?.assisted_rules || {}, summary: closing.summary, eventType });
  return { ok: true, precontractId: pc.precontractId, approvalHash: hash, reasons, mode, auto, eventType };
}

/**
 * Aprova e enfileira o link (humano ou modo liberado). Revalida a versão: se o pré-contrato mudou
 * desde a preparação, atualiza o hash e exige nova aprovação.
 */
export async function approveAndQueueLink({ supabase, workspaceId, closingId, approvalHash, actor = null, mode = 'manual' }) {
  const { data: closing } = await supabase.from('ai_closings').select('*').eq('id', closingId).eq('workspace_id', workspaceId).maybeSingle();
  if (!closing) return { ok: false, status: 'not_found' };
  if (['approved', 'link_sent'].includes(closing.status)) return { ok: true, status: 'already_sent', outboxId: closing.link_outbox_id };
  if (closing.status !== 'awaiting_approval') return { ok: false, status: 'not_awaiting' };
  const { data: pc } = await supabase.from('precontracts').select('*').eq('id', closing.precontract_id).eq('workspace_id', workspaceId).maybeSingle();
  if (!pc) return { ok: false, status: 'precontract_missing' };
  const { data: contract } = await supabase.from('contracts').select('status, signed_at').eq('precontract_id', pc.id).eq('workspace_id', workspaceId).maybeSingle();
  if (['signed', 'assinado', 'cancelled', 'canceled', 'archived'].includes(String(pc.status)) || contract?.status === 'signed' || contract?.signed_at) {
    return { ok: false, status: 'precontract_final' };
  }
  const currentHash = await approvalHashOf(closing.id, snapshotOf(pc));
  if (currentHash !== closing.approval_hash) {
    await supabase.from('ai_closings').update({ approval_hash: currentHash, prepared_snapshot: snapshotOf(pc), updated_at: new Date().toISOString() }).eq('id', closing.id);
    return { ok: false, status: 'version_changed', approvalHash: currentHash };
  }
  if (approvalHash !== currentHash) return { ok: false, status: 'version_changed', approvalHash: currentHash };
  const { data, error } = await supabase.rpc('ai_approve_closing', {
    p_workspace_id: workspaceId, p_closing_id: closing.id, p_approval_hash: currentHash, p_actor: actor, p_mode: mode,
    p_message: linkMessage(pc.generated_link),
  });
  if (error) return { ok: false, status: 'error' };
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.status === 'approved' && pc.status === 'draft') {
    // Só após a aprovação o pré-contrato fica acessível e a validade (Manual §15: 15 dias) começa a contar.
    await supabase.from('precontracts').update({ status: 'link_generated', expires_at: buildPrecontractExpiresAt(), updated_at: new Date().toISOString() })
      .eq('id', pc.id).eq('workspace_id', workspaceId).eq('status', 'draft');
  }
  return { ok: ['approved', 'already_sent'].includes(row?.status), status: row?.status, outboxId: row?.outbox_id || null };
}

/** Chamado quando o outbox confirma o envio do link aprovado. */
export async function markLinkSent({ supabase, workspaceId, outboxId, settings }) {
  const { data: closing } = await supabase.from('ai_closings').select('id, conversation_id, precontract_id, status')
    .eq('workspace_id', workspaceId).eq('link_outbox_id', outboxId).maybeSingle();
  if (!closing || closing.status === 'link_sent') return null;
  // Transição condicional: só uma chamada (mesmo concorrente) agenda os lembretes.
  const { data: moved } = await supabase.from('ai_closings').update({ status: 'link_sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', closing.id).eq('status', 'approved').select('id').maybeSingle();
  if (!moved) return null;
  await supabase.rpc('ai_set_sales_stage', { p_workspace_id: workspaceId, p_conversation_id: closing.conversation_id, p_stage: 'contract_sent', p_reason: 'precontract_link' });
  if (settings?.signature_reminders_enabled) {
    await supabase.rpc('ai_schedule_signature_reminders', {
      p_workspace_id: workspaceId, p_conversation_id: closing.conversation_id, p_precontract_id: closing.precontract_id,
      p_days: settings.signature_reminder_days || [2, 7, 12], p_templates: settings.signature_reminder_templates || [],
    });
  }
  return closing.id;
}

export async function rejectClosing({ supabase, workspaceId, closingId, actor, reason }) {
  const { data } = await supabase.from('ai_closings').update({ status: 'rejected', rejected_reason: String(reason || '').slice(0, 300) || 'rejeitado', approved_by: actor, updated_at: new Date().toISOString() })
    .eq('id', closingId).eq('workspace_id', workspaceId).eq('status', 'awaiting_approval').select('conversation_id').maybeSingle();
  if (!data) return { ok: false };
  await supabase.from('ai_conversations').update({ needs_human: true, needs_human_reason: 'closing_review', updated_at: new Date().toISOString() })
    .eq('id', data.conversation_id).eq('workspace_id', workspaceId);
  return { ok: true };
}
