// One semantic turn for the simulator and WhatsApp. The LLM chooses the intent;
// domain tools own prices, memory, permissions and durable actions.
import { acceptSimulationClosing, simulationClosingSignature } from '../commercial/closing.mjs';
import { MEMORY_FIELDS, applyMemoryOps } from '../commercial/memory.mjs';
import { parseStructuredEventRequest } from '../commercial/structured-intake.mjs';
import { generateReply } from './llm.mjs';

export const NARA_ENGINE_VERSION = 'conversation-v7';
const CUSTOMER_FIELDS = MEMORY_FIELDS.filter((f) => f !== 'ultimo_orcamento' && !f.startsWith('_'));
const ACTIONS = { answer: null, formations: 'listar_formacoes', prices: 'consultar_precos',
  reception_options: 'comparar_receptivo', quote: 'calcular_orcamento', venue: 'pesquisar_espaco', closing: 'preparar_fechamento',
  handoff: 'transferir_para_humano', approval: 'solicitar_aprovacao' };
export const TURN_TOOL = {
  type: 'function', name: 'conduzir_atendimento', strict: false,
  description: 'Interprete a última mensagem no contexto da conversa e da oferta anterior. Atualize só fatos confirmados pelo cliente e escolha a ação útil agora. Executa memória antes da ação. Preço decisivo pede prices; aceite de formações pede formations; waiting não repete opções. Corrigir local substitui o antigo.',
  parameters: { type: 'object', additionalProperties: false,
    properties: {
      intent: { type: 'string', enum: ['quote_request', 'correction', 'accept_offer', 'price_decision', 'waiting', 'contract', 'question', 'human_request', 'venue'] },
      facts: { type: 'object', additionalProperties: false, properties: Object.fromEntries(CUSTOMER_FIELDS.map((f) => [f, { type: ['string', 'null'] }])) },
      comparison_formations: { type: 'array', items: { type: 'string' }, maxItems: 7, description: 'Somente formações cujos preços o cliente pediu para comparar; não muda a escolha atual.' },
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

// The customer enters the exact door/address in their pre-contract link;
// only essential event facts block creating the confirmed summary.
export function closingMissing(lead = {}) {
  return ['data_evento', 'horario', 'cidade', 'local', 'formacao'].filter((k) => !lead[k]);
}

export function isDirectClosingRequest(message = '') {
  const t = String(message).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\b(?:como\s+(?:fechamos|contratamos)|vamos\s+fechar|quero\s+fechar|podemos\s+fechar|pode\s+(?:fechar|preparar\s+(?:o\s+)?(?:pre.?contrato|contrato))|vamos\s+contratar|quero\s+contratar|vamos\s+assinar|fechamos\s+(?:entao|assim))\b/.test(t);
}

// Business precedence is driven by the semantic intent, never by keywords or
// canned replies. The model cannot make optional discovery block requested prices.
const PRICE_TOOLS = new Set(['consultar_precos', 'calcular_orcamento', 'comparar_receptivo']);
const PRICE_ACTIONS = new Set(['prices', 'quote', 'reception_options']);
// A new price request or genuine change in event details may reopen a quote.
// Information-only follow-ups must not re-insert a full table just because
// the planner over-classified "quanto tempo dura?" as quote_request.
export function shouldPreventQuoteReplay({ text = '', previouslyQuoted = false, factsChanged = false, acceptingPriceOffer = false } = {}) {
  if (!previouslyQuoted || factsChanged || acceptingPriceOffer) return false;
  const t = String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const asksPrice = /\b(preco|precos|valor|valores|orcamento|orcamentos|cotacao|cotar|tabela|desconto|barato|barata|quanto custa|quanto fica|qual custo|quanto sai)\b/.test(t)
    || /\b(custa|custaria|preco|precos)\b/.test(t);
  // A hypothetical date/formation/service change is a NEW scenario even if
  // the customer does not repeat the word "preço": "E se for em julho com 1h
  // de receptivo?" must compute from the official rules.
  const scenarioChange = /\b(e se|se for|se fosse|se eu|e caso|no lugar de|alterar|mudar|trocar|incluir|adicionar|acrescentar|tirar|remover)\b/.test(t)
    && /\b(data|dia|mes|janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|hora|horas|receptivo|recepcao|som|cerimonia|formacao|duo|trio|quarteto|quinteto|sexteto|septeto|violino|piano|teclado|vocal|cantor)\b/.test(t);
  return !asksPrice && !scenarioChange;
}

export function resolveCommercialAction({ intent, action, facts = {}, comparison_formations }, lead = {}, { preventQuoteReplay = false, resumeClosing = false } = {}) {
  if (intent === 'contract' || resumeClosing) return 'closing';
  if (preventQuoteReplay && (PRICE_ACTIONS.has(action) || ['quote_request', 'price_decision'].includes(intent)
      || comparison_formations?.length)) return 'answer';
  if (comparison_formations?.length) return 'prices';
  if (intent === 'waiting') return 'answer';
  if (action === 'reception_options') return action;
  const hasConfirmedLocation = (typeof facts.cidade === 'string' && facts.cidade.trim())
    || (typeof facts.local === 'string' && facts.local.trim());
  // The customer's answer to 'which city?' can be classified as venue/question,
  // not only correction. In an ongoing quote, resume pricing as soon as the
  // confirmed location arrives; exploratory searches are filtered beforehand.
  const needsPrices = ['quote_request', 'price_decision'].includes(intent)
    || (lead._objetivo_comercial === 'pricing' && hasConfirmedLocation
      && !['waiting', 'human_request'].includes(intent));
  // The calculator can quote current reference items without a date (partial,
  // not final). Keep chosen reception formation/sound instead of dropping them.
  if (needsPrices) return lead.cidade ? (lead.formacao ? 'quote' : 'prices') : lead.local ? 'venue' : 'answer';
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
    'requer_aprovacao', 'registrado', 'receipt', 'simulated', 'status', 'endereco', 'cidade', 'source_url', 'missing', 'candidatos', 'nome_espaco', 'confirmacao_recomendada']) {
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

function offersUnapprovedQuote(text, { futureOnly = false } = {}) {
  const clauses = String(text).split(/[.!?;\n]+|,?\s+\b(?:mas|por[eé]m|contudo)\b\s+/i);
  return clauses.some((clause) => {
    const offer = /\b(?:posso|podemos|vou|vamos|consigo|irei|quer|deseja|gostaria|segue|aqui est[aã]o)\b.{0,75}(?:valores? oficiais?|or[cç]amento oficial|(?:passar|enviar|trazer|apresentar|seguir para).{0,25}(?:valores|pre[cç]os))/i.exec(clause);
    return offer && !(futureOnly && /^(?:segue|aqui est[aã]o)/i.test(offer[0])) && !/\bn[aã]o\s*$/i.test(clause.slice(0, offer.index));
  });
}

const repertoireClauses = (text) => String(text).split(/[.!?;\n]+|,?\s+\b(?:mas|por[eé]m|contudo)\b\s+/i);
const musicalCommitment = (text) => /repert[oó]rio\s+(?:ter[aá]|inclui|incluir[aá])\s+.+|\b(?:tocamos|tocaremos|executamos|executaremos)\b\s+.+|(?:incluindo|inclu[ií]mos)\s+(?:m[uú]sicas|can[cç][oõ]es)\s+.+|(?:podemos|vamos|consigo)\s+(?:tocar|executar)\s+.+|(?:podemos|vamos|consigo)\s+incluir\s+(?:m[uú]sicas|can[cç][oõ]es|repert[oó]rio)\s+.+/i.exec(text);
const normalizedClaim = (text) => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function unverifiedRepertoire(text, evidence) {
  return repertoireClauses(text).some((clause) => {
    const claim = musicalCommitment(clause);
    if (!claim) return false;
    const prefix = clause.slice(0, claim.index);
    // An offer to include a quote item is not a musical commitment. Explicit
    // uncertainty is also safe without evidence of performance capability.
    if (/(?:n[aã]o\s+(?:posso|consigo|podemos).{0,20}(?:confirmar|garantir)|(?:confirmar|avaliar|verificar)\s+(?:se|que)|a confirmar|depende)/i.test(prefix)) return false;
    const actual = normalizedClaim(claim[0]);
    const denied = /\bn[aã]o\s*$/i.test(prefix);
    // Deictic wording does not identify the actual artist/song to authorize.
    if (/\b(solicitad[oa]s?|escolhid[oa]s?|essas?|estas?|suas?)\b/.test(actual)) return true;
    return !repertoireClauses(evidence).some((source) => {
      const approvedClaim = musicalCommitment(source);
      if (!approvedClaim) return false;
      const sourcePrefix = source.slice(0, approvedClaim.index);
      const sourceDenied = /\bn[aã]o\s*$/i.test(sourcePrefix);
      if (denied !== sourceDenied || /confirmar|avalia|viabilidade|depende|sujeit|verificar/i.test(source)) return false;
      if (!denied && /\bnao\b/.test(normalizedClaim(source))) return false;
      if (/\b(?:se|somente|apenas)\b|valida[cç]|condi[cç]|aprova[cç]|autoriza[cç]/i.test(sourcePrefix)) return false;
      return normalizedClaim(approvedClaim[0]) === actual;
    });
  });
}

export function commercialReplyIssue(text, receipts = [], { quoteNeedsReview = false, quoteRendered = false, repertoireEvidence = '', venueLocationNeeded = false } = {}) {
  let reply;
  try { reply = JSON.parse(text); } catch { return 'commercial_reply_invalid'; }
  if (!reply || typeof reply.text !== 'string' || typeof reply.after !== 'string') return 'commercial_reply_invalid';
  if (/R\s*\$|\bBRL\b|\d[\d.,]*\s+reais\b/i.test(`${reply.text} ${reply.after}`)) return 'commercial_price_outside_renderer';
  if (quoteNeedsReview && offersUnapprovedQuote(`${reply.text} ${reply.after}`)) return 'commercial_quote_requires_review';
  if (quoteRendered && (offersUnapprovedQuote(`${reply.text} ${reply.after}`, { futureOnly: true })
    || /(?:estou preparando|vou (?:te )?(?:trazer|enviar|passar|apresentar)).{0,80}(?:valores|pre[cç]os|tabela|or[cç]amento|detalhes)/i.test(`${reply.text} ${reply.after}`))) return 'commercial_quote_already_rendered';
  if (unverifiedRepertoire(`${reply.text} ${reply.after}`, repertoireEvidence)) return 'commercial_repertoire_unverified';
  if (venueLocationNeeded && !/(?:envie|enviar|mande|mandar|compartilhe|compartilhar|informe|informar|tem|pode|consegue).{0,65}(?:endere[cç]o|localiza[cç][aã]o|link|ponto)/i.test(`${reply.text} ${reply.after}`)) return 'commercial_venue_location_needed';
  if (/\b(?:est[aá]|est[aã]o|estar[aá]|encontra-se|temos|h[aá])\s+(?:(?:completamente|totalmente|ainda|n[aã]o)\s+)?(?:dispon[ií]ve(?:l|is)|indispon[ií]ve(?:l|is)|livre(?:s)?|ocupad[oa]s?)\b/i.test(`${reply.text} ${reply.after}`)) return 'commercial_availability_unverified';
  if (reply.action_claim === 'registered' && !receipts.some((r) => !r.simulated)) return 'commercial_action_not_recorded';
  if (reply.action_claim === 'simulated' && !receipts.some((r) => r.simulated)) return 'commercial_action_not_simulated';
  return null;
}

export async function runCommercialTurn({ system, input, tools, execute, remember,
  conversation, effects = {}, simulated = false, repertoireEvidence = '', generate = generateReply, env = process.env, fetchImpl = fetch } = {}) {
  // Read the actual most recent CUSTOMER turn, never the previous assistant
  // quote in case an upstream transport delivered mixed provider timestamps.
  const latestUserText = input.findLast((m) => m.role === 'user')?.content || input.at(-1)?.content || '';
  const structuredRequest = parseStructuredEventRequest(latestUserText);
  // A completed site request is already an instruction to quote, not an
  // invitation for another intake questionnaire. Extract explicit fields
  // without a separate LLM round and let the official tools price them.
  if (structuredRequest) {
    const saved = await remember({ ...structuredRequest, _objetivo_comercial: 'pricing' });
    if (saved?.error) throw new Error('commercial_memory_not_saved');
  }
  const acceptance = simulated ? acceptSimulationClosing(conversation, latestUserText, input.findLast(m => m.role === 'assistant')?.content) : null;
  if (acceptance) return { text: acceptance, model: env.AI_INBOX_MODEL || 'gpt-4.1-mini', inputTokens: 0, outputTokens: 0, costUsd: 0, toolCalls: [], intent: 'accept_offer', receipts: [{ name: 'confirmar_resumo', simulated: true }], diagnostics: [], engineVersion: NARA_ENGINE_VERSION };
  const latestText = latestUserText;
  const previousReply = input.findLast((m) => m.role === 'assistant')?.content || '';
  // WhatsApp stores ultimo_orcamento; the simulator also supplies earlier
  // assistant turns. Either is enough to recognize an existing quote.
  const previouslyQuoted = Boolean(conversation.lead_data?.ultimo_orcamento)
    || input.some((m) => m.role === 'assistant'
      && /Or[cç]amentos Cerim[oô]nia|Valores? de refer[eê]ncia|Valor parcial|Total de refer[eê]ncia/i.test(m.content || ''));
  let preventQuoteReplay = false;
  let planned = false;
  const receipts = [];
  const diagnostics = [];
  const replyOptions = () => ({ quoteNeedsReview: conversation.lead_data?._cotacao_status === 'review',
    quoteRendered: Boolean(effects.quoteTableText || effects.quoteText), repertoireEvidence, venueLocationNeeded: effects.venueLocationNeeded === true });
  const invoke = async (name, args = {}) => {
    // The model may request an optional extra pricing tool after planning.
    // Enforce the same no-duplicate rule on those calls, without blocking
    // explicit fresh-price requests or a changed event.
    if (preventQuoteReplay && PRICE_TOOLS.has(name)) {
      return { ok: true, status: 'quote_already_present', resent: false };
    }
    if (['consultar_precos', 'calcular_orcamento', 'comparar_receptivo'].includes(name)) {
      delete effects.quoteTableText;
      delete effects.quoteText;
    }
    if (name === 'preparar_fechamento') {
      const missing = closingMissing(conversation.lead_data);
      if (missing.length) return { ok: false, missing, status: 'closing_details_needed' };
    }
    const raw = await execute(name, args);
    if (name === 'pesquisar_espaco') effects.venueLocationNeeded = ['not_found', 'unavailable'].includes(raw?.status) && !raw?.missing?.includes('cidade');
    if (['consultar_precos', 'calcular_orcamento', 'comparar_receptivo'].includes(name)) {
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
    // The validated financial summary already owns the complete customer text.
    // A further model round can only misclassify its real/simulated receipt.
    completeFromTools: () => effects.closingSummaryText ? JSON.stringify({ text: '', after: '', action_claim: receipts.some((r) => r.simulated) ? 'simulated' : 'none' }) : null,
    validateOutput: (text) => !planned ? 'commercial_context_not_planned' : commercialReplyIssue(text, receipts, replyOptions()),
    executeTool: async (name, args) => {
      if (name !== TURN_TOOL.name) {
        if (!planned) return { ok: false, status: 'context_required' };
        return invoke(name, args);
      }
      if (planned || !Object.hasOwn(ACTIONS, args?.action)) return { ok: false, status: 'invalid_plan' };
      const updates = Object.fromEntries(Object.entries(args.facts || {})
        .filter(([k]) => CUSTOMER_FIELDS.includes(k)).map(([k, v]) => [k, v === null ? 'remover' : v]));
      // In a structured site request, explicit labeled fields take precedence
      // over the model's guesses about the same input.
      if (structuredRequest) Object.assign(updates, structuredRequest);
      // A search target is not a confirmed change to the event venue. Keep it
      // in operation arguments rather than overwriting the customer's memory.
      const venueQuery = args.action === 'venue' ? {
        local: args.venue_query?.local || updates.local || conversation.lead_data?.local,
        cidade: args.venue_query?.cidade || updates.cidade || conversation.lead_data?.cidade,
      } : {};
      // Only discard location facts for a separate exploratory venue lookup.
      // The customer naming their event venue, or answering its city, is a
      // confirmed fact even when the planner selected the 'venue' tool.
      const exploratoryVenue = args.action === 'venue' && Boolean(args.venue_query)
        && Boolean(conversation.lead_data?.local) && Boolean(conversation.lead_data?.cidade)
        && !['correction', 'quote_request', 'price_decision', 'contract'].includes(args.intent);
      if (exploratoryVenue) for (const key of ['local', 'cidade', 'endereco']) delete updates[key];
      const directClosing = isDirectClosingRequest(latestText);
      if (directClosing || args.intent === 'contract') updates._objetivo_comercial = 'closing';
      else if (['quote_request', 'price_decision'].includes(args.intent)) updates._objetivo_comercial = 'pricing';
      // A new city without a reconfirmed venue must not inherit the old venue.
      if (updates.cidade && conversation.lead_data?.cidade && updates.cidade !== conversation.lead_data.cidade
        && !Object.hasOwn(updates, 'local')) updates.local = 'remover';
      const beforeFacts = { ...(conversation.lead_data || {}) };
      const saved = await remember(updates);
      if (saved?.error) return { ok: false, status: 'memory_not_saved' };
      const pricingFields = ['cidade', 'local', 'data_evento', 'formacao', 'instrumentos',
        'som', 'recepcao_horas', 'recepcao_formacao', 'recepcao_instrumentos'];
      const factsChanged = pricingFields.some((key) =>
        String(beforeFacts[key] || '') !== String(conversation.lead_data?.[key] || ''));
      // "Sim" after an actual offer to compare values is a legitimate acceptance.
      const acceptedPriceOffer = args.intent === 'accept_offer'
        && /(?:posso|quer|gostaria|se quiser|te mostrar).{0,100}(?:valores|pre[cç]os|or[cç]amento)/i.test(previousReply);
      preventQuoteReplay = shouldPreventQuoteReplay({ text: latestText,
        previouslyQuoted, factsChanged, acceptingPriceOffer: acceptedPriceOffer });
      if (simulated && conversation.simulation_closing?.signature !== simulationClosingSignature(conversation.lead_data)) conversation.simulation_closing = null;
      planned = true;
      effects.intent = args.intent;
      // After a clear decision to contract, newly supplied missing details
      // continue the same closing. An unrelated later question must not
      // reopen the summary automatically.
      const missingBefore = closingMissing(beforeFacts);
      const missingNow = closingMissing(conversation.lead_data);
      const resumeClosing = beforeFacts._objetivo_comercial === 'closing'
        && missingBefore.length > 0 && missingNow.length === 0
        && missingBefore.some((key) => Object.hasOwn(updates, key));
      const selected = resolveCommercialAction({ ...args,
        intent: structuredRequest ? 'quote_request' : directClosing ? 'contract' : args.intent,
        facts: updates }, conversation.lead_data, { preventQuoteReplay, resumeClosing });
      const action = ACTIONS[selected];
      const facts = Object.fromEntries(Object.entries(conversation.lead_data || {}).filter(([k]) => CUSTOMER_FIELDS.includes(k)));
      const lead = conversation.lead_data || {};
      const priceArgs = selected === 'prices' ? {
        ...(args.comparison_formations?.length ? { formacoes: args.comparison_formations } : lead.formacao ? { formacao: lead.formacao } : {}),
        com_som: ['sim', 'true', 'com'].includes(String(lead.som || '').toLowerCase()),
        recepcao_horas: Number(lead.recepcao_horas) || 0,
      } : {};
      const outcome = action ? await invoke(action, selected === 'approval'
        ? { tipo: 'other', resumo: latestUserText || 'Solicitação comercial' }
        : selected === 'handoff' ? { motivo: latestUserText || 'Atendimento comercial' } : selected === 'venue' ? venueQuery : priceArgs)
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
  const issue = commercialReplyIssue(result.text, receipts, replyOptions());
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
