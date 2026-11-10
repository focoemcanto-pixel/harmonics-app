// One semantic turn for the simulator and WhatsApp. The LLM chooses the intent;
// domain tools own prices, memory, permissions and durable actions.
import { MEMORY_FIELDS, applyMemoryOps } from '../commercial/memory.mjs';
import { generateReply } from './llm.mjs';

export const NARA_ENGINE_VERSION = 'conversation-v1';
const CUSTOMER_FIELDS = MEMORY_FIELDS.filter((f) => f !== 'ultimo_orcamento');
const ACTIONS = { answer: null, formations: 'listar_formacoes', prices: 'consultar_precos',
  quote: 'calcular_orcamento', venue: 'pesquisar_espaco', closing: 'preparar_fechamento',
  handoff: 'transferir_para_humano', approval: 'solicitar_aprovacao' };
export const TURN_TOOL = {
  type: 'function', name: 'conduzir_atendimento', strict: false,
  description: 'Interprete a última mensagem no contexto da conversa e da oferta anterior. Atualize só fatos confirmados pelo cliente e escolha a ação útil agora. Executa memória antes da ação. Preço decisivo pede prices; aceite de formações pede formations; waiting não repete opções. Corrigir local substitui o antigo.',
  parameters: { type: 'object', additionalProperties: false,
    properties: {
      intent: { type: 'string', enum: ['quote_request', 'correction', 'accept_offer', 'price_decision', 'waiting', 'contract', 'question', 'human_request'] },
      facts: { type: 'object', additionalProperties: false, properties: Object.fromEntries(CUSTOMER_FIELDS.map((f) => [f, { type: ['string', 'null'] }])) },
      action: { type: 'string', enum: Object.keys(ACTIONS) },
    }, required: ['intent', 'facts', 'action'] },
};
export const COMMERCIAL_REPLY_FORMAT = {
  type: 'json_schema', name: 'commercial_reply', strict: true,
  schema: { type: 'object', additionalProperties: false,
    properties: { text: { type: 'string', description: 'Mensagem natural ao cliente; se há bloco de preço pronto, apenas introdução sem números.' },
      after: { type: 'string', description: 'Conclusão opcional depois do bloco de preço, sem repetir dados nem fazer perguntas desnecessárias.' },
      action_claim: { type: 'string', enum: ['none', 'registered', 'simulated'] } }, required: ['text', 'after', 'action_claim'] },
};

export function closingMissing(lead = {}) {
  return ['data_evento', 'horario', 'cidade', 'local', 'endereco', 'formacao'].filter((k) => !lead[k]);
}

// Deliberate allowlist. Administrative errors, rules, costs, SQL metadata and
// tool-authored writing instructions never enter the conversation model.
export function customerToolResult(name, raw = {}, effects = {}) {
  if (!raw.ok) return {
    ok: false,
    status: raw.erro === 'local_necessario' || raw.erro === 'cidade_necessaria' ? 'city_needed'
      : raw.erro === 'espaco_nao_verificado' ? 'address_unconfirmed'
        : ['localidade_sem_parametrizacao', 'orcamento_personalizado', 'regiao_sem_tabela'].includes(raw.erro || raw.motivo) ? 'individual_quote_needed' : 'not_confirmed',
    ...(raw.missing ? { missing: raw.missing } : {}),
    ...(raw.registrado ? { registrado: true, simulated: Boolean(raw.simulated) } : {}),
  };
  const out = { ok: true };
  for (const key of ['salvo', 'formacoes', 'instrumentos_sugeridos', 'tipos_evento', 'rider', 'vocalistas', 'link', 'cliente_contratado',
    'encontrado', 'eventos', 'orcamentos', 'data_referencia', 'localidade', 'formacao', 'valor_cerimonia',
    'valor_recepcao', 'valor_som', 'itens', 'total', 'parcial', 'pendencias', 'a_confirmar_pela_equipe',
    'registrado', 'receipt', 'simulated', 'status', 'endereco', 'cidade', 'source_url', 'missing']) {
    if (raw[key] !== undefined) out[key] = raw[key];
  }
  if (name === 'consultar_disponibilidade') out.reserva_confirmada = false;
  if (effects.quoteTableText) {
    out.tabela_pronta = true;
    // Exact prices go straight to the customer renderer, not through paraphrase.
    delete out.itens; delete out.total; delete out.parcial;
  }
  if (effects.quoteText) { out.orcamento_pronto = true; delete out.itens; delete out.total; delete out.parcial; }
  if (effects.closingSummaryText) out.resumo_fechamento_pronto = true;
  return out;
}

export async function runCommercialTurn({ system, input, tools, execute, remember,
  conversation, effects = {}, generate = generateReply, env = process.env, fetchImpl = fetch } = {}) {
  let planned = false;
  const receipts = [];
  const diagnostics = [];
  const invoke = async (name, args = {}) => {
    if (name === 'preparar_fechamento') {
      const missing = closingMissing(conversation.lead_data);
      if (missing.length) return { ok: false, missing, status: 'closing_details_needed' };
    }
    const raw = await execute(name, args);
    diagnostics.push({ ferramenta: name, resultado: raw?.ok ? 'ok' : 'pendente' });
    if (raw?.registrado) receipts.push({ name, simulated: Boolean(raw.simulated), receipt: raw.receipt || null });
    return customerToolResult(name, raw, effects);
  };
  const result = await generate({ system, input, tools: [TURN_TOOL, ...tools], env, fetchImpl,
    toolChoice: TURN_TOOL.name, responseFormat: COMMERCIAL_REPLY_FORMAT,
    executeTool: async (name, args) => {
      if (name !== TURN_TOOL.name) {
        if (!planned) return { ok: false, status: 'context_required' };
        return invoke(name, args);
      }
      if (planned || !Object.hasOwn(ACTIONS, args?.action)) return { ok: false, status: 'invalid_plan' };
      const updates = Object.fromEntries(Object.entries(args.facts || {})
        .filter(([k]) => CUSTOMER_FIELDS.includes(k)).map(([k, v]) => [k, v === null ? 'remover' : v]));
      // A new city without a reconfirmed venue must not inherit the old venue.
      if (updates.cidade && updates.cidade !== conversation.lead_data?.cidade && !Object.hasOwn(updates, 'local')) updates.local = 'remover';
      const saved = await remember(updates);
      if (saved?.error) return { ok: false, status: 'memory_not_saved' };
      planned = true;
      effects.intent = args.intent;
      const action = ACTIONS[args.action];
      const facts = Object.fromEntries(Object.entries(conversation.lead_data || {}).filter(([k]) => CUSTOMER_FIELDS.includes(k)));
      const outcome = action ? await invoke(action, args.action === 'approval'
        ? { tipo: 'other', resumo: input.at(-1)?.content || 'Solicitação comercial' }
        : args.action === 'handoff' ? { motivo: input.at(-1)?.content || 'Atendimento comercial' } : {}) : { ok: true };
      return { intent: args.intent, facts, action: args.action, outcome };
    },
  });
  if (!planned) throw new Error('commercial_context_not_planned');
  let reply;
  try { reply = JSON.parse(result.text); } catch { throw new Error('commercial_reply_invalid'); }
  if (!reply || typeof reply.text !== 'string' || typeof reply.after !== 'string') throw new Error('commercial_reply_invalid');
  if (reply.action_claim === 'registered' && !receipts.some((r) => !r.simulated)) throw new Error('commercial_action_not_recorded');
  if (reply.action_claim === 'simulated' && !receipts.some((r) => r.simulated)) throw new Error('commercial_action_not_simulated');
  const text = effects.closingSummaryText || [reply.text.trim(), effects.quoteTableText || effects.quoteText, reply.after.trim()].filter(Boolean).join('\n\n');
  return { ...result, text, intent: effects.intent, receipts, diagnostics, engineVersion: NARA_ENGINE_VERSION };
}

export function rememberInSession(conversation, updates) {
  const result = applyMemoryOps(conversation.lead_data || {}, updates);
  conversation.lead_data = result.next;
  return { changed: result.events.length > 0, lead: result.next };
}
