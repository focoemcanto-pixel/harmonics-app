/**
 * Aprendizado supervisionado: observa respostas humanas autorizadas (Inbox e app Business)
 * e correções de rascunhos da IA, agrupa padrões recorrentes e cria SUGESTÕES. Nada entra em
 * vigor sem aprovação; aprovar cria uma versão de conhecimento (exemplo/FAQ/resposta).
 */
import { tokenize, slugKey } from './knowledge.mjs';

export const RECURRING_THRESHOLD = 3;

export function patternKey(customerText) {
  const tokens = [...new Set(tokenize(customerText))].sort().slice(0, 6);
  return tokens.length >= 2 ? tokens.join('+') : null;
}

/** Diferença relevante entre rascunho da IA e texto enviado pela equipe. */
export function isMeaningfulEdit(aiText, humanText) {
  const a = tokenize(aiText);
  const b = tokenize(humanText);
  if (!b.length) return false;
  const setA = new Set(a);
  const overlap = b.filter((t) => setA.has(t)).length / Math.max(a.length, b.length, 1);
  return overlap < 0.85;
}

async function upsertSuggestion({ supabase, workspaceId, conversationId, kind, key, customerText, aiText = null, humanText }) {
  const { data: existing } = await supabase.from('ai_learning_suggestions').select('id, occurrences')
    .eq('workspace_id', workspaceId).eq('kind', kind).eq('pattern_key', key).eq('status', 'pending').maybeSingle();
  if (existing) {
    await supabase.from('ai_learning_suggestions').update({
      occurrences: Number(existing.occurrences || 1) + 1,
      human_text: String(humanText).slice(0, 2000),
      customer_text: String(customerText || '').slice(0, 1000),
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id);
    return { id: existing.id, occurrences: Number(existing.occurrences || 1) + 1 };
  }
  const { data } = await supabase.from('ai_learning_suggestions').insert({
    workspace_id: workspaceId, conversation_id: conversationId, kind, pattern_key: key,
    customer_text: String(customerText || '').slice(0, 1000),
    ai_text: aiText ? String(aiText).slice(0, 2000) : null,
    human_text: String(humanText).slice(0, 2000),
  }).select('id').maybeSingle();
  return { id: data?.id || null, occurrences: 1 };
}

/** Resposta humana a uma pergunta do cliente => sugestão (agrupada por padrão). */
export async function observeHumanReply({ supabase, workspaceId, conversationId }) {
  const { data: recent } = await supabase.from('ai_messages').select('direction, sender_type, origin, content, transcript, created_at')
    .eq('workspace_id', workspaceId).eq('conversation_id', conversationId)
    .order('created_at', { ascending: false }).limit(6);
  const msgs = recent || [];
  const human = msgs[0];
  if (!human || human.direction !== 'outbound' || human.sender_type !== 'human' || !human.content) return null;
  const customer = msgs.find((m) => m.direction === 'inbound');
  const customerText = customer?.transcript || customer?.content || '';
  const key = patternKey(customerText);
  if (!key || human.content.length < 15) return null;
  return upsertSuggestion({ supabase, workspaceId, conversationId, kind: 'human_reply', key, customerText, humanText: human.content });
}

/** Rascunho da IA editado antes do envio => sugestão de correção. */
export async function observeDraftCorrection({ supabase, workspaceId, conversationId, aiText, humanText, customerText }) {
  if (!isMeaningfulEdit(aiText, humanText)) return null;
  const key = patternKey(customerText) || slugKey(humanText).slice(0, 40);
  return upsertSuggestion({ supabase, workspaceId, conversationId, kind: 'correction', key, customerText, aiText, humanText });
}

/** Aprovar sugestão => conhecimento ativo (versionado). Rejeitar => arquivada. */
export async function decideSuggestion({ supabase, workspaceId, suggestionId, decision, actor, edit = {} }) {
  const { data: s } = await supabase.from('ai_learning_suggestions').select('*')
    .eq('id', suggestionId).eq('workspace_id', workspaceId).eq('status', 'pending').maybeSingle();
  if (!s) return { ok: false, error: 'not_found' };
  const now = new Date().toISOString();
  if (decision === 'rejected') {
    await supabase.from('ai_learning_suggestions').update({ status: 'rejected', decided_by: actor, decided_at: now, updated_at: now }).eq('id', s.id);
    return { ok: true };
  }
  const kind = ['example', 'faq', 'response', 'style'].includes(edit.kind) ? edit.kind : (s.occurrences >= RECURRING_THRESHOLD ? 'faq' : 'example');
  const title = String(edit.title || s.customer_text || 'Exemplo aprovado').slice(0, 120);
  const content = String(edit.content || `Cliente: ${s.customer_text}\nResposta aprovada: ${s.human_text}`).slice(0, 2000);
  const { data: proposed, error } = await supabase.rpc('ai_knowledge_propose', {
    p_workspace_id: workspaceId, p_item_key: `learned-${slugKey(s.pattern_key)}`, p_kind: kind, p_title: title,
    p_content: content, p_intents: edit.intents || [], p_keywords: [], p_metadata: { suggestion_id: s.id },
    p_priority: 50, p_source: 'learned', p_actor: actor,
  });
  if (error) return { ok: false, error: error.message };
  const row = Array.isArray(proposed) ? proposed[0] : proposed;
  await supabase.rpc('ai_knowledge_activate', { p_workspace_id: workspaceId, p_id: row.id, p_actor: actor });
  await supabase.from('ai_learning_suggestions').update({ status: 'approved', knowledge_item_id: row.id, decided_by: actor, decided_at: now, updated_at: now }).eq('id', s.id);
  return { ok: true, knowledge_item_id: row.id, kind };
}
