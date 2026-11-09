/**
 * Central de supervisão (Manual §20.1/20.2): filas de trabalho para o responsável.
 * Cartões com telefone real, link do WhatsApp (wa.me) e do Inbox; sem dados de outros workspaces.
 */
import { getPrecontractExpirationDate } from '../../contracts/precontract-expiration';

export function whatsappLink(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 10 ? `https://wa.me/${digits}` : null;
}

function card(conv, extra = {}) {
  const lead = conv?.lead_data || {};
  return {
    conversation_id: conv?.id || null,
    contact_name: conv?.contact_name || lead.nome || null,
    phone: conv?.provider_chat_id || null,
    whatsapp_url: whatsappLink(conv?.provider_chat_id),
    inbox_url: conv?.id ? `/inbox?c=${conv.id}` : null,
    event: { type: lead.tipo_evento || null, date: lead.data_evento || null, location: lead.local || lead.cidade || null },
    stage: conv?.sales_stage || null,
    owner: conv?.owner || null,
    last_message: conv?.last_message_preview || null,
    last_message_at: conv?.last_message_at || null,
    summary: conv?.handoff_summary || null,
    ...extra,
  };
}

export async function buildQueues({ supabase, workspaceId, now = new Date() }) {
  const since = new Date(now.getTime() - 14 * 86400000).toISOString();
  const { data: settingsRow } = await supabase.from('ai_workspace_settings').select('handoff_contact_name').eq('workspace_id', workspaceId).maybeSingle();
  const [needs, approvals, closings, followups, failed, sent, learning, pendingKnowledge, pendingPricing] = await Promise.all([
    supabase.from('ai_conversations').select('*').eq('workspace_id', workspaceId).eq('needs_human', true).eq('state', 'open').limit(100),
    supabase.from('ai_approvals').select('*').eq('workspace_id', workspaceId).eq('status', 'pending').limit(200),
    supabase.from('ai_closings').select('*').eq('workspace_id', workspaceId).in('status', ['awaiting_approval', 'approved']).limit(100),
    supabase.from('ai_followups').select('*').eq('workspace_id', workspaceId).eq('status', 'scheduled').limit(200),
    supabase.from('ai_message_outbox').select('id, conversation_id, status, last_error, content, updated_at').eq('workspace_id', workspaceId).in('status', ['failed', 'unknown']).gte('updated_at', since).limit(100),
    supabase.from('ai_closings').select('*').eq('workspace_id', workspaceId).eq('status', 'link_sent').limit(200),
    supabase.from('ai_learning_suggestions').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'pending'),
    supabase.from('ai_knowledge_items').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'pending_approval'),
    supabase.from('ai_pricing_proposals').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'pending'),
  ]);
  const convIds = new Set([
    ...(approvals.data || []).map((a) => a.conversation_id), ...(closings.data || []).map((c) => c.conversation_id),
    ...(followups.data || []).map((f) => f.conversation_id), ...(failed.data || []).map((f) => f.conversation_id),
    ...(sent.data || []).map((c) => c.conversation_id),
  ].filter(Boolean));
  const { data: convs } = convIds.size
    ? await supabase.from('ai_conversations').select('*').eq('workspace_id', workspaceId).in('id', [...convIds])
    : { data: [] };
  const byId = new Map([...(convs || []), ...(needs.data || [])].map((c) => [c.id, c]));

  const marcos = [
    ...(needs.data || []).map((c) => card(c, { kind: 'takeover', reason: c.needs_human_reason, created_at: c.updated_at })),
    ...(approvals.data || []).filter((a) => a.kind !== 'closing').map((a) => card(byId.get(a.conversation_id), { kind: a.kind, approval_id: a.id, reason: a.summary, details: a.details, created_at: a.created_at })),
  ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  const pcIds = [...(closings.data || []), ...(sent.data || [])].map((c) => c.precontract_id).filter(Boolean);
  const { data: pcs } = pcIds.length
    ? await supabase.from('precontracts').select('id, status, created_at, generated_link, event_date, agreed_amount').eq('workspace_id', workspaceId).in('id', pcIds)
    : { data: [] };
  const pcById = new Map((pcs || []).map((p) => [p.id, p]));
  const contracts = (closings.data || []).map((c) => card(byId.get(c.conversation_id), {
    kind: 'closing', closing_id: c.id, status: c.status, approval_hash: c.approval_hash, summary_text: c.summary_text,
    snapshot: c.prepared_snapshot, exceptions: c.exception_reasons || [], conventional: c.conventional,
    precontract: pcById.get(c.precontract_id) || null, created_at: c.updated_at,
  }));

  const followupCards = [
    ...(followups.data || []).map((f) => card(byId.get(f.conversation_id), { kind: f.kind === 'signature' ? 'signature_reminder' : 'quote_followup', due_at: f.due_at, step: f.step, template: f.template_name })),
    ...(failed.data || []).map((f) => card(byId.get(f.conversation_id), { kind: 'send_failed', reason: f.last_error, status: f.status, created_at: f.updated_at })),
  ];
  for (const c of sent.data || []) {
    const pc = pcById.get(c.precontract_id);
    if (!pc || ['signed', 'assinado', 'cancelled', 'canceled', 'archived'].includes(String(pc.status))) continue;
    const expires = getPrecontractExpirationDate(pc);
    const days = expires ? Math.ceil((expires.getTime() - now.getTime()) / 86400000) : null;
    followupCards.push(card(byId.get(c.conversation_id), {
      kind: days !== null && days <= 3 ? 'precontract_expiring' : 'signature_pending', closing_id: c.id, expires_at: expires?.toISOString() || null, days_left: days, sent_at: c.sent_at,
    }));
  }
  return {
    handoff_name: settingsRow?.handoff_contact_name || null,
    marcos, contracts, followups: followupCards,
    learning: { suggestions: learning.count || 0, knowledge: pendingKnowledge.count || 0, pricing: pendingPricing.count || 0 },
    counts: { marcos: marcos.length, contracts: contracts.length, followups: followupCards.length },
  };
}
