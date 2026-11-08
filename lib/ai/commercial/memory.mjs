/**
 * Memória por cliente (lead_data da conversa, única por número+workspace) com operações no
 * modelo do mem0 (ADD/UPDATE/DELETE/NONE), aplicadas de forma determinística a campos
 * estruturados — sem chamada extra de LLM. Cada operação é auditada em ai_memory_events.
 */
export const MEMORY_FIELDS = Object.freeze([
  'nome', 'tipo_evento', 'data_evento', 'horario', 'cidade', 'local', 'convidados',
  'formacao', 'instrumentos', 'recepcao_formacao', 'recepcao_instrumentos', 'recepcao_horas',
  'som', 'preferencias', 'observacoes',
]);
const DELETE_WORDS = new Set(['remover', 'apagar', 'nenhum', 'nenhuma', 'nao', 'não', '-']);

export function applyMemoryOps(current = {}, updates = {}) {
  const next = { ...(current || {}) };
  const events = [];
  for (const key of MEMORY_FIELDS) {
    if (!Object.hasOwn(updates || {}, key)) continue;
    const raw = updates[key];
    const value = typeof raw === 'string' ? raw.trim().slice(0, 200) : raw == null ? '' : String(raw).slice(0, 200);
    const old = next[key];
    if (!value) continue;
    if (DELETE_WORDS.has(value.toLowerCase())) {
      if (old !== undefined) { delete next[key]; events.push({ op: 'DELETE', key, old_value: String(old), new_value: null }); }
      continue;
    }
    if (old === undefined) { next[key] = value; events.push({ op: 'ADD', key, old_value: null, new_value: value }); }
    else if (String(old) !== value) { next[key] = value; events.push({ op: 'UPDATE', key, old_value: String(old), new_value: value }); }
  }
  return { next, events };
}

export async function persistMemory({ supabase, workspaceId, conversation, updates }) {
  const { next, events } = applyMemoryOps(conversation?.lead_data || {}, updates);
  if (!events.length) return { changed: false, lead: next };
  const { error } = await supabase.from('ai_conversations').update({ lead_data: next, updated_at: new Date().toISOString() })
    .eq('id', conversation.id).eq('workspace_id', workspaceId);
  if (error) return { changed: false, error };
  await supabase.from('ai_memory_events').insert(events.map((e) => ({ ...e, workspace_id: workspaceId, conversation_id: conversation.id })));
  conversation.lead_data = next;
  return { changed: true, lead: next, events };
}
