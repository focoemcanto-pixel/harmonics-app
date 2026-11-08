/**
 * Consultas do Inbox (somente leitura), sempre escopadas pelo workspace autenticado.
 */
export const CONVERSATION_LIST_FIELDS =
  'id, provider_chat_id, contact_name, contact_phone, owner, owner_version, state, needs_human, needs_human_reason, unread_count, last_message_at, last_message_preview, last_message_direction, last_inbound_at, ai_enabled, assigned_user_id, updated_at';

export const INBOX_FILTERS = Object.freeze(['all', 'needs_human', 'ai', 'human', 'unread', 'closed']);

export function applyInboxFilter(query, filter) {
  switch (filter) {
    case 'needs_human': return query.eq('needs_human', true).eq('state', 'open');
    case 'ai': return query.eq('owner', 'ai').eq('state', 'open');
    case 'human': return query.eq('owner', 'human').eq('state', 'open');
    case 'unread': return query.gt('unread_count', 0);
    case 'closed': return query.eq('state', 'closed');
    default: return query;
  }
}

export function sanitizeSearch(term) {
  return String(term || '').replace(/[%,()*"\\:]/g, ' ').trim().slice(0, 60);
}

export async function listConversations({ supabase, workspaceId, filter = 'all', search = '', updatedAfter = null, limit = 50 }) {
  let query = supabase.from('ai_conversations').select(CONVERSATION_LIST_FIELDS)
    .eq('workspace_id', workspaceId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(Math.min(Math.max(Number(limit) || 50, 1), 100));
  query = applyInboxFilter(query, INBOX_FILTERS.includes(filter) ? filter : 'all');
  const term = sanitizeSearch(search);
  if (term) query = query.or(`contact_name.ilike.%${term}%,provider_chat_id.ilike.%${term.replace(/\D/g, '') || term}%`);
  if (updatedAfter) query = query.gt('updated_at', updatedAfter);
  return query;
}

export async function getInboxCounters({ supabase, workspaceId }) {
  const head = { count: 'exact', head: true };
  const [needsHuman, unread, aiOpen, pendingApprovals] = await Promise.all([
    supabase.from('ai_conversations').select('id', head).eq('workspace_id', workspaceId).eq('needs_human', true).eq('state', 'open'),
    supabase.from('ai_conversations').select('id', head).eq('workspace_id', workspaceId).gt('unread_count', 0),
    supabase.from('ai_conversations').select('id', head).eq('workspace_id', workspaceId).eq('owner', 'ai').eq('state', 'open'),
    supabase.from('ai_approvals').select('id', head).eq('workspace_id', workspaceId).eq('status', 'pending'),
  ]);
  return {
    needs_human: needsHuman.count || 0,
    unread: unread.count || 0,
    ai_open: aiOpen.count || 0,
    pending_approvals: pendingApprovals.count || 0,
  };
}

export async function getConversationDetail({ supabase, workspaceId, conversationId, before = null, limit = 50 }) {
  const { data: conversation, error } = await supabase.from('ai_conversations').select('*')
    .eq('id', conversationId).eq('workspace_id', workspaceId).maybeSingle();
  if (error || !conversation) return { conversation: null };
  let messagesQuery = supabase.from('ai_messages')
    .select('id, direction, sender_type, origin, content, transcript, message_type, status, provider_created_at, created_at, error_code')
    .eq('workspace_id', workspaceId).eq('conversation_id', conversationId)
    .order('created_at', { ascending: false }).limit(Math.min(Number(limit) || 50, 200));
  if (before) messagesQuery = messagesQuery.lt('created_at', before);
  const [messages, outbox, approvals, handoffs] = await Promise.all([
    messagesQuery,
    supabase.from('ai_message_outbox').select('id, content, status, sender_type, last_error, created_at')
      .eq('workspace_id', workspaceId).eq('conversation_id', conversationId)
      .in('status', ['draft', 'pending', 'dispatching', 'failed', 'unknown']).order('created_at', { ascending: true }).limit(20),
    supabase.from('ai_approvals').select('id, kind, summary, status, created_at')
      .eq('workspace_id', workspaceId).eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(10),
    supabase.from('ai_handoffs').select('from_owner, to_owner, reason, created_at')
      .eq('workspace_id', workspaceId).eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(10),
  ]);
  return {
    conversation,
    messages: (messages.data || []).reverse(),
    outbox: outbox.data || [],
    approvals: approvals.data || [],
    handoffs: handoffs.data || [],
  };
}
