/**
 * Nara Agent v2 — opt-in, admin-only simulator. NEVER used by WhatsApp transport.
 * Uses the official Vercel AI SDK ToolLoopAgent; no mandatory intent/action call.
 * Existing approved Supabase knowledge and existing commercial domain executors.
 * All effects are isolated in createSimulationStore by the route.
 */
import { ToolLoopAgent, isStepCount, tool, jsonSchema } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { TOOL_DEFINITIONS } from './tools.mjs';
import { customerToolResult, rememberInSession, isOpenReceptionInquiry, shouldPreventQuoteReplay, isDirectClosingRequest } from './conversation-turn.mjs';
import { parseStructuredEventRequest } from '../commercial/structured-intake.mjs';
import { acceptSimulationClosing } from '../commercial/closing.mjs';
import { formatClientMemory, MEMORY_FIELDS } from '../commercial/memory.mjs';
import { estimateCostUsd } from './llm.mjs';

export const NARA_V2_VERSION = 'nara-agent-v2-ai-sdk7-preview';
export const V2_ALLOWED = Object.freeze([
  'listar_formacoes', 'consultar_rider', 'verificar_localidade', 'pesquisar_espaco',
  'consultar_tabela_receptivo', 'comparar_receptivo', 'consultar_precos',
  'calcular_orcamento', 'registrar_dados_evento', 'solicitar_aprovacao',
  'transferir_para_humano', 'preparar_fechamento',
]);
const ALLOWED = new Set(V2_ALLOWED);
const PRICE_TOOLS = new Set(['consultar_tabela_receptivo','comparar_receptivo','consultar_precos','calcular_orcamento']);
const SENSITIVE_ACTIONS = new Set(['solicitar_aprovacao','transferir_para_humano','preparar_fechamento']);
const QUOTE_REGEX = /R\s*\$\s*\d|[\d.,]+\s+reais\b|\bBRL\b/i;
const CONFIRMED_FORMATION = /\b(?:solo|duo|trio|quarteto|quinteto|sexteto|septeto)\b/i;
const QUOTE_IN_HISTORY = /Or[cç]amentos Cerim[oô]nia|Valores? de refer[eê]ncia|Valor parcial|Total de refer[eê]ncia|Receptivo ap[oó]s a cerim[oô]nia/i;
const FUTURE_PRICE_PROMISE = /(?:vou|podemos|posso|irei).{0,65}(?:enviar|mandar|passar|apresentar).{0,40}(?:or[cç]amento|tabela|valores|pre[cç]os)/i;
const MONEY_ONLY_FROM_TOOLS = 'Os valores, equipamentos, serviços, descontos, agenda e contratos SÓ podem vir das ferramentas oficiais.';

export function buildNaraV2Prompt({ settings = {}, companyName = 'Banda Harmonics', conversation = {}, commercial = {}, isFirstReply = false, today = new Date() } = {}) {
  const lead = formatClientMemory(conversation);
  const lines = [
    'Você é ' + String(settings.assistant_name || 'Nara') + ', assistente virtual e consultora comercial da ' + String(settings.assistant_company || companyName) + '.',
    'Hoje: ' + today.toISOString().slice(0,10) + '. Fuso: America/Bahia. Português brasileiro natural, gentil, objetivo, como uma boa consultora por WhatsApp.',
    'AGENTE LIVRE: interprete a mensagem atual com o contexto de toda a conversa. Você pode RESPONDER DIRETAMENTE sem chamar ferramenta quando a dúvida for informativa. Não há roteiro obrigatório nem escolha forçada de ação a cada mensagem.',
    'Não anuncie seu mecanismo, memórias, ausência de tabela interna, aprovações técnicas, palavras como modelo/função/banco de dados, nem os passos internos do sistema.',
    isFirstReply ? 'Primeiro contato: apresente-se uma única vez, brevemente.' : 'Cliente já está conversando: não se reapresente.',
    'Evite perguntas repetidas, ofertas circulares, mensagens longas e roteiros copiados. Se receber só "Casamento", peça numa única mensagem os poucos dados faltantes. Se receber "quero ver as opções", MOSTRE, sem pedir outro "sim".',
    'Quando a pessoa disser que ainda não tem horário, aceite e apresente preços iniciais se cidade/local conhecidos. Não trate horário indefinido como impedimento para valores de referência.',
    'Use registrar_dados_evento APENAS para informações explicitamente confirmadas pelo cliente. Quando o cliente alterar cidade, data, formação ou serviço, registre a alteração ANTES de recalcular o orçamento. Se o nome do local foi identificado pela consulta oficial, confirme a cidade naturalmente. Não registre formações nem som não escolhidos.',
    'Duas escolhas SEPARADAS: a formação da cerimônia e a formação do RECEPTIVO podem ser distintas. A pergunta "E receptivo?" é interesse aberto, NÃO significa Duo, Trio, 1h nem 2h. Use consultar_tabela_receptivo para mostrar Duo a Sexteto × 1h, 2h, 3h. Explique que receptivo é adicional à cerimônia, mais sonorização/logística quando aplicável.',
    'Se a pessoa escolheu formação e duração do receptivo, consulte calcular_orcamento com as escolhas confirmadas; NÃO faça automaticamente uma comparação de 1, 2 e 3 horas. Se o cliente pedir o TOTAL, priorize o resumo calculado, nunca a tabela geral.',
    'ATENÇÃO À EQUIPE: músicos do receptivo que já tocaram na cerimônia e permanecem recebem custo interno adicional de R$ 100 por hora; músico novo, contratado exclusivamente para o receptivo, recebe custo interno de R$ 350 pela primeira hora e R$ 100 por hora seguinte. Identifique PESSOAS, não só instrumentos: trocar violino por cajón pode exigir outro profissional, mas um músico multi-instrumentista pode permanecer. Esses valores são CUSTOS INTERNOS, não preços de venda; NÃO some cachês ao preço de tabela nem divulgue cachês ao cliente. Uma formação diferente exige cotação oficial que considere músicos novos, margem, logística e preços aprovados. Sem confirmação de identidade dos músicos ou regra oficial de venda para a troca, NÃO apresente total definitivo; peça validação da proposta.',
    'Formação e instrumentos podem ser personalizados; nunca presuma que um instrumento opcional foi contratado. Som não incluso por padrão, mas nunca presuma que o cliente rejeitou som ao escrever "sem..." incompleto.',
    'Orçamentos de cerimônia: se cliente quer valores e tem cidade, consulte consultar_precos. Não invente cifras. Se recebeu tabela antes e perguntou apenas "Como funciona? Quanto tempo tocam?", explique sem repetir a tabela.',
    'Se o cliente informar nome de espaço conhecido, use pesquisar_espaco e confirme localização sucintamente; não pergunte cidade genericamente se a memória já sabe.',
    'Quando alguém decidir fechar, use preparar_fechamento somente após dados essenciais. Retome a contratação quando chegar o campo pendente. Jamais ofereça recepções extras após o aceite.',
    'Nunca confirme disponibilidade, reserva, músico ou contrato apenas por ver dados. Exceções/descontos/cláusulas precisam de aprovação humana. Não prometas envio, prazo, contrato ou reserva que as ferramentas não efetivaram.',
    'No Chat de Testes: qualquer registro/encaminhamento é SIMULADO. Nenhum contrato, link real, reserva, mensagem WhatsApp ou mudança de produção poderá ocorrer. O resumo requer confirmação expressa e a etapa posterior é apenas uma demonstração.',
    'SEGURANÇA: ' + MONEY_ONLY_FROM_TOOLS,
    'Somente um bloco oficial de tabela/cotação será inserido pelo servidor após sua resposta. Se a ferramenta indicar tabela_pronta ou resumo_fechamento_pronto, fale no máximo uma introdução humana curta, SEM citar cifras nem repetir itens, e SEM prometer envio posterior.',
    'Quando um preço não estiver parametrizado para a região, explique brevemente que precisa de avaliação, sem inventar um número ou usar preços de outra cidade.',
    settings.business_description ? 'Contexto do negócio: ' + String(settings.business_description).slice(0,950) : '',
    settings.tone_notes ? 'Tom e preferências: ' + String(settings.tone_notes).slice(0,1100) : '',
    'Fatos já confirmados na conversa (não pergunte novamente):',
    lead || 'Nenhum dado de evento confirmado ainda.',
    commercial.knowledgeText ? 'Conhecimento aprovado relevante (não copie como script):\n' + String(commercial.knowledgeText).slice(0,2300) : '',
    commercial.examplesText ? 'Exemplos históricos apenas para interpretação, não política:\n' + String(commercial.examplesText).slice(0,950) : '',
    commercial.strategiesText ? 'Orientações comerciais:\n' + String(commercial.strategiesText).slice(0,700) : '',
    commercial.repertoireEvidence ? 'Referências musicais aprovadas:\n' + String(commercial.repertoireEvidence).slice(0,850) : '',
  ];
  return lines.filter(Boolean).join('\n');
}

function formattedDate(raw) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(raw || '').trim());
  if (!m) return raw;
  const iso = m[3] + '-' + m[2] + '-' + m[1];
  const date = new Date(iso + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === iso ? iso : raw;
}

export function safeV2Args(name, raw = {}, lead = {}, latestText = '') {
  const args = { ...(raw && typeof raw === 'object' ? raw : {}) };
  if (name === 'registrar_dados_evento') {
    for (const key of Object.keys(args)) if (!MEMORY_FIELDS.includes(key) || key.startsWith('_')) delete args[key];
    if (args.data_evento) args.data_evento = formattedDate(args.data_evento);
    if (args.horario && /^\d{1,2}\s*(?:h|hrs?|horas)$/i.test(args.horario)) args.horario = String(args.horario).replace(/\D/g,'').padStart(2,'0') + ':00';
    if (!lead.formacao && !CONFIRMED_FORMATION.test(latestText)) delete args.formacao;
    // A new formation for the reception must not silently replace the ceremony.
    if (lead.formacao && /\b(receptivo|recep[cç][aã]o)\b/i.test(latestText)
      && !/\bcerim[oô]nia\b/i.test(latestText)) delete args.formacao;
    if (args.som && !/\b(som|sonoriza[cç][aã]o)\b/i.test(latestText)) delete args.som;
    if (!/receptiv|recep[cç][aã]o/i.test(latestText)
      && !/\b[123]\s*(?:h|hr|hrs|hora|horas)\b/i.test(latestText) && !lead.recepcao_formacao) {
      delete args.recepcao_formacao; delete args.recepcao_horas;
    }
    if (isOpenReceptionInquiry(latestText)) {
      delete args.formacao; delete args.recepcao_formacao;
      delete args.recepcao_horas; delete args.som;
    }
  } else if (name === 'consultar_precos' || name === 'calcular_orcamento') {
    if (args.formacao && !lead.formacao && !CONFIRMED_FORMATION.test(latestText)) delete args.formacao;
    if (name === 'calcular_orcamento' && !args.formacao && !lead.formacao) return null;
  }
  return args;
}

export function v2PriceReplayBlocked({ latestText = '', input = [], lead = {} } = {}) {
  const quoted = Boolean(lead.ultimo_orcamento)
    || input.some(m => m.role === 'assistant' && QUOTE_IN_HISTORY.test(m.content || ''));
  const newChoice = /\b(?:quero|gostei|prefiro|escolhi|vamos\s+com|adicionar|incluir|trocar|mudar)\b.{0,75}\b(?:receptivo|recep[cç][aã]o|duo|trio|quarteto|quinteto|sexteto|piano|violino|voz|som|sonoriza[cç][aã]o|[123]\s*(?:h|hr|hrs|hora|horas))\b/i.test(latestText);
  const standalone = /^\s*(solo|duo|trio|quarteto|quinteto|sexteto|septeto)[.!]?\s*$/i.exec(latestText);
  const newFormation = Boolean(standalone && String(lead.formacao || '').toLowerCase() !== standalone[1].toLowerCase());
  return !isOpenReceptionInquiry(latestText) && !newChoice && !newFormation
    && shouldPreventQuoteReplay({ text: latestText, previouslyQuoted: quoted });
}

export function renderNaraV2Reply({ modelText = '', effects = {}, toolNames = [] } = {}) {
  const official = effects.closingSummaryText || effects.receptionTableText || effects.quoteTableText || effects.quoteText || '';
  let text = String(modelText || '').trim();
  const hasOfficial = Boolean(official);
  // All numbers come directly from the approved domain renderer, never an LLM paraphrase.
  if (QUOTE_REGEX.test(text)) {
    text = hasOfficial ? 'Claro, veja os detalhes oficiais:' : 'Posso consultar os valores oficiais para essa combinação, sem estimar preços por conta própria.';
  }
  if (hasOfficial && FUTURE_PRICE_PROMISE.test(text)) text = 'Claro, veja as opções:';
  if (hasOfficial && text.includes(official)) text = text.replace(official,'').trim();
  if (hasOfficial) return effects.closingSummaryText ? official : [text, official].filter(Boolean).join('\n\n');
  if (!text) return 'Pode me contar um pouco mais sobre o que você procura? Assim consigo te orientar.';
  // Prevent unsupported statements that an external action was already performed.
  if (!toolNames.some(n => SENSITIVE_ACTIONS.has(n))
    && /(?:j[aá]|acabei de)\s+(?:enviar|criar|reservar|contratar|assinar).{0,55}(?:contrato|reserva|link|proposta)/i.test(text)) {
    return 'Posso orientar você sobre a próxima etapa, mas nenhuma reserva ou documento foi gerado neste teste.';
  }
  return text;
}

export async function runNaraV2({
  input = [], conversation, settings = {}, companyName = 'Banda Harmonics',
  commercial = {}, execute, effects = {}, env = process.env, simulated = false,
  agentFactory = null, modelOverride = null,
} = {}) {
  if (!simulated || !conversation || typeof execute !== 'function') {
    throw new Error('nara_v2_simulator_only');
  }
  const latestText = input.findLast(m => m.role === 'user')?.content || '';
  const previousReply = input.findLast(m => m.role === 'assistant')?.content || '';
  const structured = parseStructuredEventRequest(latestText);
  if (structured) rememberInSession(conversation, structured);
  if (isDirectClosingRequest(latestText)) rememberInSession(conversation, { _objetivo_comercial: 'closing' });
  const acceptance = acceptSimulationClosing(conversation, latestText, previousReply);
  const modelName = String(env.AI_NARA_V2_MODEL || 'gpt-6.1-sol');
  if (acceptance) return {
    text: acceptance, model: modelName, inputTokens: 0, outputTokens: 0, costUsd: 0,
    toolCalls: [], diagnostics: [], engineVersion: NARA_V2_VERSION,
    intent: 'accept_offer', simulated: true,
  };
  const apiKey = String(env.OPENAI_API_KEY || '').trim();
  if (!apiKey && !agentFactory) throw new Error('llm_not_configured');
  const toolNames = [];
  const diagnostics = [];
  const closingRequested = isDirectClosingRequest(latestText);
  const closingPending = conversation.lead_data?._objetivo_comercial === 'closing';
  const receptionOverview = isOpenReceptionInquiry(latestText) && !closingRequested;
  const replayBlocked = v2PriceReplayBlocked({ latestText, input, lead: conversation.lead_data || {} });
  let priceReturned = false;
  let criticalFactsChanged = false;
  const invoke = async (name, args = {}) => {
    if (!ALLOWED.has(name)) return { ok: false, status: 'not_authorized' };
    const clean = safeV2Args(name, args, conversation.lead_data || {}, latestText);
    if (clean === null) return { ok: false, missing: ['formacao'], status: 'formation_not_selected' };
    if (name === 'preparar_fechamento' && !(isDirectClosingRequest(latestText)
      || conversation.lead_data?._objetivo_comercial === 'closing')) {
      return { ok: false, status: 'explicit_closing_required' };
    }
    if (PRICE_TOOLS.has(name) && ((priceReturned || (replayBlocked && !criticalFactsChanged)) && !(receptionOverview && !priceReturned))) {
      return { ok: true, status: 'official_price_already_present', resent: false };
    }
    if (receptionOverview && PRICE_TOOLS.has(name) && name !== 'consultar_tabela_receptivo') {
      return { ok: false, status: 'reception_formation_not_selected', hint: 'Use a tabela de receptivo por formação e duração.' };
    }
    const beforeFacts = { ...(conversation.lead_data || {}) };
    const raw = await execute(name, clean);
    if (name === 'registrar_dados_evento' && raw?.ok) {
      const relevant = ['cidade','local','data_evento','formacao','instrumentos','som','recepcao_formacao','recepcao_horas','recepcao_instrumentos'];
      criticalFactsChanged ||= relevant.some(key => String(beforeFacts[key] || '') !== String(conversation.lead_data?.[key] || ''));
    }
    toolNames.push(name);
    diagnostics.push({ ferramenta: name, resultado: raw?.ok ? 'ok' : 'pendente' });
    if (PRICE_TOOLS.has(name) && raw?.ok) {
      priceReturned = Boolean(effects.receptionTableText || effects.quoteTableText || effects.quoteText);
    }
    return customerToolResult(name, raw, effects);
  };

  // Critical quotation safety: the user asked for reception possibilities, not
  // an invented Duo. This deterministic read does not force a scripted answer.
  let prefetched = null;
  if (receptionOverview) prefetched = await invoke('consultar_tabela_receptivo', {});
  // When the customer has already accepted the offer, finishing the intake must
  // resume the closing tool even if the latest message only answers a detail.
  // The tool remains the sole authority for pricing and simulation safeguards.
  const leadForClosing = conversation.lead_data || {};
  const closingReady = Boolean(leadForClosing.data_evento && leadForClosing.horario && leadForClosing.cidade && leadForClosing.local && leadForClosing.formacao);
  if (closingPending && closingReady && !conversation.simulation_closing?.lastReply) {
    const closingResult = await invoke('preparar_fechamento', {});
    if (closingResult?.ok && effects.closingSummaryText) {
      return { text: effects.closingSummaryText, model: modelName, inputTokens: 0, outputTokens: 0, costUsd: 0,
        toolCalls: [...new Set(toolNames)], diagnostics, engineVersion: NARA_V2_VERSION,
        intent: 'closing_summary', simulated: true };
    }
  }
  const toolset = Object.fromEntries(TOOL_DEFINITIONS.filter(d => ALLOWED.has(d.name)).map(def => [
    def.name, tool({
      description: def.description,
      inputSchema: jsonSchema(def.parameters || { type:'object', properties:{}, additionalProperties:false }),
      execute: async params => invoke(def.name, params),
    }),
  ]));
  let instructions = buildNaraV2Prompt({
    settings, companyName, conversation, commercial,
    isFirstReply: !input.some(m => m.role === 'assistant'),
  });
  if (prefetched?.tabela_receptivo_pronta) {
    instructions += '\nA ferramenta oficial JÁ GEROU a tabela de receptivo que o servidor anexará nesta resposta. Introduza com naturalidade, sem repetir valores ou pedir outra confirmação.';
  }
  const model = modelOverride || createOpenAI({ apiKey }).responses(modelName);
  const config = {
    model, instructions, tools: toolset,
    stopWhen: isStepCount(6),
    maxOutputTokens: 1200,
    providerOptions: { openai: { store: false, parallelToolCalls: false,
      ...(modelName.startsWith('gpt-6') ? { reasoningEffort: 'low', textVerbosity: 'low' } : {}) } },
  };
  const agent = agentFactory ? agentFactory(config) : new ToolLoopAgent(config);
  const result = await agent.generate({
    messages: input.slice(-36).map(m => ({ role: m.role, content: m.content })),
    timeout: { totalMs: 45_000 },
  });
  // A model may register the final missing field but stop before invoking closing.
  // Resume through the approved domain tool, never by fabricating a summary.
  const latestLead = conversation.lead_data || {};
  if (latestLead._objetivo_comercial === 'closing' && !effects.closingSummaryText
    && !conversation.simulation_closing?.lastReply
    && latestLead.data_evento && latestLead.horario && latestLead.cidade && latestLead.local && latestLead.formacao
    && !toolNames.includes('preparar_fechamento')) {
    await invoke('preparar_fechamento', {});
  }
  const text = renderNaraV2Reply({ modelText: result.text, effects, toolNames });
  const usage = result.totalUsage || result.usage || {};
  const inputTokens = Number(usage.inputTokens ?? usage.input_tokens ?? 0);
  const outputTokens = Number(usage.outputTokens ?? usage.output_tokens ?? 0);
  return {
    text, model: modelName, inputTokens, outputTokens,
    costUsd: estimateCostUsd(modelName, inputTokens, outputTokens, env),
    toolCalls: [...new Set(toolNames)], diagnostics,
    engineVersion: NARA_V2_VERSION, intent: 'free_conversation',
    simulated: true,
  };
}
