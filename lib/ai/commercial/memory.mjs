/**
 * Memória por cliente (lead_data da conversa, única por número+workspace) com operações no
 * modelo do mem0 (ADD/UPDATE/DELETE/NONE), aplicadas de forma determinística a campos
 * estruturados — sem chamada extra de LLM. Cada operação é auditada em ai_memory_events.
 */
export const MEMORY_FIELDS = Object.freeze([
  'nome', 'tipo_evento', 'data_evento', 'horario', 'cidade', 'local', 'convidados',
  'formacao', 'instrumentos', 'recepcao_formacao', 'recepcao_instrumentos', 'recepcao_horas',
  'som', 'preferencias', 'observacoes',
  // Sinais comerciais (skills de descoberta/negociação): o que pesa, quem decide, orçamento e prazo.
  'orcamento', 'decisores', 'prioridades', 'prazo_decisao',
]);

// Privacidade: nunca memorizar documentos, cartões ou sequências longas de dígitos (CPF/CNPJ/cartão/conta).
const SENSITIVE = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|(?:\d[ .-]?){13,19}|\b\d{11,}\b|\bcvv\b|\bsenha\b/i;
export function isSensitiveValue(value) { return SENSITIVE.test(String(value || '')); }
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
    if (isSensitiveValue(value)) { events.push({ op: 'REJECT_SENSITIVE', key, old_value: null, new_value: null }); continue; }
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
  const { next, events: all } = applyMemoryOps(conversation?.lead_data || {}, updates);
  const rejected = all.filter((e) => e.op === 'REJECT_SENSITIVE').map((e) => e.key);
  const events = all.filter((e) => e.op !== 'REJECT_SENSITIVE');
  if (!events.length) return { changed: false, lead: next, rejected };
  const { error } = await supabase.from('ai_conversations').update({ lead_data: next, updated_at: new Date().toISOString() })
    .eq('id', conversation.id).eq('workspace_id', workspaceId);
  if (error) return { changed: false, error };
  await supabase.from('ai_memory_events').insert(events.map((e) => ({ ...e, workspace_id: workspaceId, conversation_id: conversation.id })));
  conversation.lead_data = next;
  return { changed: true, lead: next, events, rejected };
}

const nrm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const WHO = '(noivo|noiva|mae|pai|marido|esposa|familia|sogra|sogro|cerimonialista|assessora|assessor)';

/**
 * Sinais comerciais da mensagem da cliente, extraídos de forma determinística (sem LLM extra):
 * orçamento, quem decide junto e prazo de decisão. Só o que a própria cliente disse.
 */
export function extractSignals(text) {
  const t = nrm(text);
  const out = {};
  const budget = /(orcamento|grana|verba|dinheiro)\s+(esta|ta|anda|e|meio|bem|muito)?\s*(apertad[oa]|curt[oa]|limitad[oa]|baixo|contad[oa])/.exec(t)
    || /(no maximo|ate|teto de|limite de)\s+(r\$\s*)?\d[\d.]*(,\d{2})?\s*(mil|reais)?/.exec(t);
  if (budget) out.orcamento = budget[0].trim().slice(0, 80);
  const who = new RegExp(`(quem decide|decide comigo|decide junto|decidir com|decidimos|falar com|conversar com|ver com|consultar)\\s+(e |sao |com )?(o |a |meu |minha |com (o |a |meu |minha )?)?${WHO}`).exec(t)
    || new RegExp(`(meu|minha) ${WHO}\\s+(que )?(decide|vai decidir|e quem decide|que paga|vai pagar)`).exec(t);
  if (who) out.decisores = who[0].replace(/.*\b(noivo|noiva|mae|pai|marido|esposa|familia|sogra|sogro|cerimonialista|assessora|assessor)\b.*/, '$1');
  const deadline = /(decidir|fechar|resolver|definir)\s+(ate|antes de|na proxima|nesta|essa|ate o fim d[ao])\s+([a-z0-9/ ]{3,20})/.exec(t);
  if (deadline) out.prazo_decisao = deadline[0].slice(0, 60);
  return out;
}

/** Guarda os sinais da última mensagem (retrieve → generate → store, no modelo do mem0), com auditoria. */
export async function rememberSignals({ supabase, workspaceId, conversation, latestText }) {
  const updates = extractSignals(latestText);
  if (!Object.keys(updates).length) return { changed: false };
  return persistMemory({ supabase, workspaceId, conversation, updates });
}

const LABELS = {
  nome: 'Nome', tipo_evento: 'Evento', data_evento: 'Data', horario: 'Horário', cidade: 'Cidade', local: 'Local', convidados: 'Convidados',
  formacao: 'Formação', instrumentos: 'Instrumentos', recepcao_formacao: 'Receptivo (formação)', recepcao_instrumentos: 'Receptivo (instrumentos)',
  recepcao_horas: 'Receptivo (horas)', som: 'Som', preferencias: 'Preferências', observacoes: 'Observações',
  orcamento: 'Orçamento (sinal)', decisores: 'Decide junto com', prioridades: 'O que mais importa', prazo_decisao: 'Prazo de decisão',
};
const OBJECTION_LABELS = { price: 'preço', discount: 'desconto', competitor: 'comparação com concorrente', stall: 'adiamento', date: 'data' };

/** Bloco de memória da cliente para o prompt: somente ESTA conversa/cliente, sem dados sensíveis. */
export function formatClientMemory(conversation = {}) {
  const lead = conversation.lead_data || {};
  const lines = MEMORY_FIELDS.filter((k) => lead[k] !== undefined && lead[k] !== '' && !isSensitiveValue(lead[k])).map((k) => `- ${LABELS[k] || k}: ${String(lead[k]).slice(0, 120)}`);
  const objections = (conversation.objections || []).map((o) => OBJECTION_LABELS[o] || o);
  if (objections.length) lines.push(`- Objeções já levantadas: ${objections.join(', ')}`);
  return lines.length ? lines.join('\n') : 'nenhum dado registrado ainda';
}
