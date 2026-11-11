// One semantic turn for the simulator and WhatsApp. The LLM chooses the intent;
// domain tools own prices, memory, permissions and durable actions.
import { MEMORY_FIELDS, applyMemoryOps } from '../commercial/memory.mjs';
import { generateReply } from './llm.mjs';

export const NARA_ENGINE_VERSION = 'conversation-v4';
const CUSTOMER_FIELDS = MEMORY_FIELDS.filter((f) => f !== 'ultimo_orcamento' && !f.startsWith('_'));
const ACTIONS = { answer: null, formations: 'listar_formacoes', prices: 'consultar_precos',
  quote: 'calcular_orcamento', venue: 'pesquisar_espaco', closing: 'preparar_fechamento',
  handoff: 'transferir_para_humano', approval: 'solicitar_aprovacao' };
export const TURN_TOOL = {
  type: 'function', name: 'conduzir_atendimento', strict: false,
  description: 'Interprete a última mensagem no contexto da conversa e da oferta anterior. Atualize só fatos confirmados pelo cliente e escolha a ação útil agora. Executa memória antes da ação. Preço decisivo pede prices; aceite de formações pede formations; waiting não repete opções. Corrigir local substitui o antigo.',
  parameters: { type: 'object', additionalProperties: false,
    properties: {
      intent: { type: 'string', enum: ['quote_request', 'correction', 'accept_offer', 'price_decision', 'waiting', 'contract', 'question', 'human_request', 'venue'] },
      facts: { type: 'object', additionalProperties: false, properties: Object.fromEntries(CUSTOMER_FIELDS.map((f) => [f, { type: ['string', 'null'] }])) },
      venue_query: { type: 'object', additionalProperties: false, properties: { local: { type: 'string' }, cidade: { type: 'string' } }, description: 'Espaço a pesquisar, inclusive alternativa. Pesquisa não altera o local confirmado do evento.' },
      action: { type: 'string', enum: Object.keys(ACTIONS) },
    }, required: ['intent', 'facts', 'action'] },
};
export const COMMERCIAL_REPLY_FORMAT = {
  type: 'json_schema', name: 'commercial_reply', strict: true,
  schema: { type: 'object', additionalProperties: false,
    properties: { text: { type: 'string', description: 'Mensagem natural ao cliente; se há bloco de preço pronto, apenas introdução sem números.' },
      after: { type: 'string', description: 'Conclusão opcional depois do bloco de preço, sem repetir dados nem fazer perguntas desnecessárias.' },
      action_claim: { type: 'string', description: 'Somente encaminhamento/solicitação comercial registrada. Consultas e memória usam none.', enum: ['none', 'registered', 'simulated'] } }, required: ['text', 'after', 'action_claim'] },
};

export function closingMissing(lead = {}) {
  return ['data_evento', 'horario', 'cidade', 'local', 'endereco', 'formacao'].filter((k) => !lead[k]);
}

// Business precedence is driven by the semantic intent, never by keywords or
// canned replies. The model cannot make optional discovery block requested prices.
export function resolveCommercialAction({ intent, action, facts = {} }, lead = {}) {
  if (intent === 'contract') return 'closing';
  if (intent === 'waiting') return 'answer';
  const needsPrices = ['quote_request', 'price_decision'].includes(intent)
    || (intent === 'correction' && lead._objetivo_comercial === 'pricing'
      && (Object.hasOwn(facts, 'cidade') || Object.hasOwn(facts, 'local')));
  // The calculator can quote current reference items without a date (partial,
  // not final). Keep chosen reception formation/sound instead of dropping them.
  if (needsPrices) return lead.cidade ? (lead.formacao ? 'quote' : 'prices') : 'answer';
  return action;
}

// Deliberate allowlist. Administrative errors, rules, costs, SQL metadata and
// tool-authored writing instructions never enter the conversation model.
export function customerToolResult(name, raw = {}, effects = {}) {
  const individualQuote = ['localidade_sem_parametrizacao', 'orcamento_personalizado', 'regiao_sem_tabela', 'precos_nao_cadastrados']
    .includes(raw.erro || raw.motivo);
  if (!raw.ok) return {
    ok: false,
    status: raw.erro === 'local_necessario' || raw.erro === 'cidade_necessaria' ? 'city_needed'
      : raw.erro === 'espaco_nao_verificado' ? 'address_unconfirmed'
        : individualQuote ? 'individual_quote_needed' : 'not_confirmed',
    ...(individualQuote ? { quote_requires_review: true, additional_details_unlock_prices: false } : {}),
    ...(raw.missing ? { missing: raw.missing } : {}),
    ...(raw.registrado ? { registrado: true, simulated: Boolean(raw.simulated) } : {}),
  };
  const out = { ok: true };
  for (const key of ['salvo', 'formacoes', 'instrumentos_sugeridos', 'tipos_evento', 'rider', 'vocalistas', 'link', 'cliente_contratado',
    'encontrado', 'eventos', 'orcamentos', 'data_referencia', 'localidade', 'formacao', 'valor_cerimonia',
    'valor_recepcao', 'valor_som', 'itens', 'total', 'parcial', 'pendencias', 'a_confirmar_pela_equipe',
    'requer_aprovacao', 'registrado', 'receipt', 'simulated', 'status', 'endereco', 'cidade', 'source_url', 'missing']) {
    if (raw[key] !== undefined) out[key] = raw[key];
  }
  if (name === 'consultar_disponibilidade') out.reserva_confirmada = false;
  if (name === 'pesquisar_espaco') {
    out.status = raw.status === 'found' ? 'lookup_found' : raw.status === 'not_found' ? 'lookup_not_found' : raw.status === 'ambiguous' ? 'lookup_ambiguous' : 'lookup_unavailable';
    out.availability_checked = false;
    out.event_location_changed = false;
  }
  if (effects.quoteTableText) {
    out.tabela_pronta = true;
    // Exact prices go straight to the customer renderer, not through paraphrase.
    delete out.itens; delete out.total; delete out.parcial;
  }
  if (effects.quoteText) {
    out.orcamento_pronto = true;
    for (const key of ['itens', 'total', 'parcial', 'valor_cerimonia', 'valor_recepcao', 'valor_som']) delete out[key];
  }
  if (effects.closingSummaryText) out.resumo_fechamento_pronto = true;
  return out;
}

function offersUnapprovedQuote(text) {
  const clauses = String(text).split(/[.!?;\n]+|,?\s+\b(?:mas|por[eé]m|contudo)\b\s+/i);
  return clauses.some((clause) => {
    const offer = /\b(?:posso|podemos|vou|vamos|consigo|irei|quer|deseja|gostaria|segue|aqui est[aã]o)\b.{0,75}(?:valores? oficiais?|or[cç]amento oficial|(?:passar|enviar|trazer|apresentar|seguir para).{0,25}(?:valores|pre[cç]os))/i.exec(clause);
    return offer && !/\bn[aã]o\s*$/i.test(clause.slice(0, offer.index));
  });
}

export function commercialReplyIssue(text, receipts = [], { quoteNeedsReview = false } = {}) {
  let reply;
  try { reply = JSON.parse(text); } catch { return 'commercial_reply_invalid'; }
  if (!reply || typeof reply.text !== 'string' || typeof reply.after !== 'string') return 'commercial_reply_invalid';
  if (/R\s*\$|\bBRL\b|\d[\d.,]*\s+reais\b/i.test(`${reply.text} ${reply.after}`)) return 'commercial_price_outside_renderer';
  if (quoteNeedsReview && offersUnapprovedQuote(`${reply.text} ${reply.after}`)) return 'commercial_quote_requires_review';
  if (/\b(?:est[aá]|est[aã]o|estar[aá]|encontra-se|temos|h[aá])\s+(?:(?:completamente|totalmente|ainda|n[aã]o)\s+)?(?:dispon[ií]ve(?:l|is)|indispon[ií]ve(?:l|is)|livre(?:s)?|ocupad[oa]s?)\b/i.test(`${reply.text} ${reply.after}`)) return 'commercial_availability_unverified';
  if (reply.action_claim === 'registered' && !receipts.some((r) => !r.simulated)) return 'commercial_action_not_recorded';
  if (reply.action_claim === 'simulated' && !receipts.some((r) => r.simulated)) return 'commercial_action_not_simulated';
  return null;
}

export async function runCommercialTurn({ system, input, tools, execute, remember,
  conversation, effects = {}, generate = generateReply, env = process.env, fetchImpl = fetch } = {}) {
  let planned = false;
  const receipts = [];
  const diagnostics = [];
  const invoke = async (name, args = {}) => {
    if (['consultar_precos', 'calcular_orcamento'].includes(name)) {
      delete effects.quoteTableText;
      delete effects.quoteText;
    }
    if (name === 'preparar_fechamento') {
      const missing = closingMissing(conversation.lead_data);
      if (missing.length) return { ok: false, missing, status: 'closing_details_needed' };
    }
    const raw = await execute(name, args);
    if (['consultar_precos', 'calcular_orcamento'].includes(name)) {
      const projected = customerToolResult(name, raw, effects);
      if (raw?.ok || projected.status === 'individual_quote_needed') {
        const saved = await remember({ _cotacao_status: raw?.ok ? 'approved' : 'review' });
        if (saved?.error) throw new Error('commercial_memory_not_saved');
      }
    }
    diagnostics.push({ ferramenta: name, resultado: raw?.ok ? 'ok' : 'pendente' });
    if (raw?.registrado) receipts.push({ name, simulated: Boolean(raw.simulated), receipt: raw.receipt || null });
    return customerToolResult(name, raw, effects);
  };
  const result = await generate({ system, input, tools: [TURN_TOOL, ...tools], env, fetchImpl,
    toolChoice: TURN_TOOL.name, responseFormat: COMMERCIAL_REPLY_FORMAT,
    validateOutput: (text) => !planned ? 'commercial_context_not_planned' : commercialReplyIssue(text, receipts, { quoteNeedsReview: conversation.lead_data?._cotacao_status === 'review' }),
    executeTool: async (name, args) => {
      if (name !== TURN_TOOL.name) {
        if (!planned) return { ok: false, status: 'context_required' };
        return invoke(name, args);
      }
      if (planned || !Object.hasOwn(ACTIONS, args?.action)) return { ok: false, status: 'invalid_plan' };
      const updates = Object.fromEntries(Object.entries(args.facts || {})
        .filter(([k]) => CUSTOMER_FIELDS.includes(k)).map(([k, v]) => [k, v === null ? 'remover' : v]));
      // A search target is not a confirmed change to the event venue. Keep it
      // in operation arguments rather than overwriting the customer's memory.
      const venueQuery = args.action === 'venue' ? {
        local: args.venue_query?.local || updates.local || conversation.lead_data?.local,
        cidade: args.venue_query?.cidade || updates.cidade || conversation.lead_data?.cidade,
      } : {};
      const exploratoryVenue = args.action === 'venue' && !['correction', 'quote_request', 'price_decision', 'contract'].includes(args.intent);
      if (exploratoryVenue) for (const key of ['local', 'cidade', 'endereco']) delete updates[key];
      if (['quote_request', 'price_decision'].includes(args.intent)) updates._objetivo_comercial = 'pricing';
      if (args.intent === 'contract') updates._objetivo_comercial = 'closing';
      // A new city without a reconfirmed venue must not inherit the old venue.
      if (updates.cidade && updates.cidade !== conversation.lead_data?.cidade && !Object.hasOwn(updates, 'local')) updates.local = 'remover';
      const saved = await remember(updates);
      if (saved?.error) return { ok: false, status: 'memory_not_saved' };
      planned = true;
      effects.intent = args.intent;
      const selected = resolveCommercialAction(args, conversation.lead_data);
      const action = ACTIONS[selected];
      const facts = Object.fromEntries(Object.entries(conversation.lead_data || {}).filter(([k]) => CUSTOMER_FIELDS.includes(k)));
      const lead = conversation.lead_data || {};
      const priceArgs = selected === 'prices' ? {
        ...(lead.formacao ? { formacao: lead.formacao } : {}),
        com_som: ['sim', 'true', 'com'].includes(String(lead.som || '').toLowerCase()),
        recepcao_horas: Number(lead.recepcao_horas) || 0,
      } : {};
      const outcome = action ? await invoke(action, selected === 'approval'
        ? { tipo: 'other', resumo: input.at(-1)?.content || 'Solicitação comercial' }
        : selected === 'handoff' ? { motivo: input.at(-1)?.content || 'Atendimento comercial' } : selected === 'venue' ? venueQuery : priceArgs)
        : ['quote_request', 'price_decision'].includes(args.intent) && !conversation.lead_data?.cidade
          ? { ok: false, missing: ['cidade'] } : { ok: true };
      return { intent: args.intent, facts, action: selected, outcome };
    },
  });
  const fail = (message) => {
    const error = new Error(message);
    // Validation failures still consumed tokens and must count toward budgets.
    error.usage = { model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, costUsd: result.costUsd };
    return error;
  };
  if (!planned) throw fail('commercial_context_not_planned');
  const issue = commercialReplyIssue(result.text, receipts, { quoteNeedsReview: conversation.lead_data?._cotacao_status === 'review' });
  if (issue) throw fail(issue);
  const reply = JSON.parse(result.text);
  const text = effects.closingSummaryText || [reply.text.trim(), effects.quoteTableText || effects.quoteText, reply.after.trim()].filter(Boolean).join('\n\n');
  return { ...result, text, toolCalls: [...new Set([...(result.toolCalls || []), ...diagnostics.map((d) => d.ferramenta)])],
    intent: effects.intent, receipts, diagnostics, engineVersion: NARA_ENGINE_VERSION };
}

export function rememberInSession(conversation, updates) {
  const result = applyMemoryOps(conversation.lead_data || {}, updates);
  conversation.lead_data = result.next;
  return { changed: result.events.length > 0, lead: result.next };
}
