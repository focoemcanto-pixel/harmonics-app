/**
 * Ferramentas da IA ligadas às APIs/tabelas existentes do Harmonics.
 * Regras: SEMPRE filtrar por workspace_id; nunca expor dados de outros clientes;
 * sem dado cadastrado => responder "indisponível" (a IA não inventa); ações com efeito
 * comercial/contratual viram pedido de aprovação humana.
 */
import {
  normalizeFormation,
  getAutomaticFormationPrice,
  getAutomaticReceptionPrice,
} from '../../eventos/eventos-finance';
import { MEMORY_FIELDS, persistMemory } from '../commercial/memory.mjs';
import { COMMERCIAL_TOOL_DEFINITIONS, COMMERCIAL_EXECUTORS } from './commercial-tools.mjs';
import { calculateQuote, resolveTerritory, hasRegionIssue, isCustomQuote, flagRegionPricing } from '../commercial/pricing.mjs';
import { customQuoteMessage } from '../commercial/geo.mjs';
import { applyLocationGate, CUSTOM_GUIDANCE } from './location-gate.mjs';

const FORMATIONS = ['Solo', 'Duo', 'Trio', 'Quarteto', 'Quinteto', 'Sexteto', 'Septeto'];
const CANCELLED_EVENT = ['cancelado', 'cancelada', 'cancelled', 'canceled'];
const LEAD_FIELDS = MEMORY_FIELDS.filter((f) => f !== 'ultimo_orcamento' && !f.startsWith('_'));

export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    name: 'consultar_disponibilidade',
    description: 'Verifica na agenda do Harmonics se já há evento registrado na data. Não confirma disponibilidade nem reserva.',
    parameters: { type: 'object', properties: { data: { type: 'string', description: 'Data no formato YYYY-MM-DD' } }, required: ['data'], additionalProperties: false },
  },
  {
    type: 'function',
    name: 'consultar_precos',
    description: 'Valores de referência oficiais (tabela vigente na data do evento). SEM formação: devolve a tabela de todas as formações com valor oficial (use quando pedirem orçamento e ainda não escolheram formação). Com formação: valores de cerimônia, recepção e som. Use antes de citar qualquer valor.',
    parameters: {
      type: 'object',
      properties: {
        formacao: { type: 'string', description: 'Solo, Duo, Trio, Quarteto, Quinteto, Sexteto ou Septeto' },
        recepcao_horas: { type: 'integer', description: 'Horas de recepção (0 a 3)' },
        com_som: { type: 'boolean' },
        data: { type: 'string', description: 'Data do evento AAAA-MM-DD (define a tabela vigente). Se omitida, usa a data já informada ou hoje.' },
        local: { type: 'string', description: 'Cidade/espaço do evento (define a faixa de preço da região). Se omitido, usa o já informado.' },
      },
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'listar_formacoes',
    description: 'Lista formações e tipos de evento atendidos, conforme cadastro da empresa.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    type: 'function',
    name: 'consultar_meu_cadastro',
    description: 'Dados do PRÓPRIO cliente desta conversa (identificado pelo número do WhatsApp): eventos, orçamentos e status de contrato.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    type: 'function',
    name: 'registrar_dados_evento',
    description: 'Guarda o que o cliente já informou (memória da conversa). Envie só campos confirmados pelo cliente.',
    parameters: {
      type: 'object',
      properties: Object.fromEntries(LEAD_FIELDS.map((f) => [f, { type: 'string' }])),
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'solicitar_aprovacao',
    description: 'Pede aprovação da equipe para proposta definitiva, desconto ou alteração contratual. Obrigatório antes de prometer qualquer um desses.',
    parameters: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['proposal', 'discount', 'contract_change', 'other'] },
        resumo: { type: 'string' },
      },
      required: ['tipo', 'resumo'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'transferir_para_humano',
    description: 'Transfere o atendimento para uma pessoa da equipe (pedido do cliente, dúvida fora do seu alcance, assunto sensível).',
    parameters: { type: 'object', properties: { motivo: { type: 'string' } }, required: ['motivo'], additionalProperties: false },
  },
];

export function phoneTail(phone, size = 8) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= size ? digits.slice(-size) : null;
}

/** Compara números BR: DDD + 8 últimos dígitos (wa_id antigo pode não ter o 9º dígito). */
export function samePhoneBR(a, b) {
  const key = (value) => {
    let d = String(value || '').replace(/\D/g, '');
    if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
    if (d.length === 11 && d[2] === '9') d = d.slice(0, 2) + d.slice(3);
    return d.length >= 10 ? d.slice(-10) : null;
  };
  const left = key(a);
  const right = key(b);
  return Boolean(left && right && left === right);
}

function isValidIsoDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(text || ''))) return false;
  const d = new Date(`${text}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

async function consultarDisponibilidade(ctx, args) {
  // Agenda da empresa (leitura agregada). Vocalistas são tratados no fechamento/escolha, sem comentar
  // a disponibilidade de ninguém com a cliente.
  return consultarAgendaEmpresa(ctx, args);
}

async function consultarAgendaEmpresa({ supabase, workspaceId }, { data }) {
  if (!isValidIsoDate(data)) return { ok: false, erro: 'data_invalida' };
  const today = new Date().toISOString().slice(0, 10);
  if (data < today) return { ok: false, erro: 'data_no_passado' };
  const { data: rows, error } = await supabase
    .from('events')
    .select('id, status')
    .eq('workspace_id', workspaceId)
    .eq('event_date', data);
  if (error) return { ok: false, erro: 'agenda_indisponivel' };
  const active = (rows || []).filter((r) => !CANCELLED_EVENT.includes(String(r.status || '').toLowerCase()));
  return {
    ok: true,
    data,
    eventos_na_data: active.length,
    leitura: active.length === 0
      ? 'Sem compromisso registrado na agenda nesta data até agora.'
      : 'A equipe precisa confirmar a agenda desta data.',
    orientacao: 'Nunca diga que a data ou alguém está "disponível" e nunca mencione à cliente se há outros eventos/compromissos na data. Diga que a equipe confirma a agenda e que a data só fica garantida com o contrato.',
  };
}

async function loadPricing({ supabase, workspaceId }) {
  // Só a linha do workspace: nunca o padrão legado nem valores default de código.
  const { data, error } = await supabase.from('pricing_settings').select('*').eq('workspace_id', workspaceId).maybeSingle();
  if (error || !data) return null;
  return data;
}

// Apresentação padrão da tabela de cerimônia (estilo definido pelo Owner). Preços vêm SEMPRE da tabela
// oficial vigente na data; instrumentos são sugestões fixas por formação.
const CEREMONY_INSTRUMENTS = {
  Duo: ['Voz', 'Piano'],
  Trio: ['Voz', 'Violão ou Piano', 'Violino'],
  Quarteto: ['Voz', 'Piano', 'Violão', 'Violino'],
  Quinteto: ['Voz', 'Piano', 'Violão', 'Violino', 'Saxofone'],
  Sexteto: ['Voz', 'Piano', 'Violão', 'Violino', 'Saxofone', 'Cajón (percussão)/Bateria'],
};
function brl(n) {
  const [int, dec] = Number(n).toFixed(2).split('.');
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${dec === '00' ? '' : `,${dec}`}`;
}

/** Localidade sem preços parametrizados: resposta fixa, sem valores e sem perguntas (nada de interrogatório). */
export function regionPendingMessage(location) {
  const place = String(location || '').trim().slice(0, 60);
  return `Para ${place ? `o seu evento em ${place}` : 'essa localidade'}, a equipe vai confirmar os valores certinho e já te retorna por aqui, tá bom? ☺️`;
}

export function formatCeremonyTable(tabela = [], { travelNote = null } = {}) {
  const blocks = tabela.filter((l) => CEREMONY_INSTRUMENTS[l.formacao] && l.valor_cerimonia)
    .map((l) => [`✨ ${l.formacao} – ${brl(l.valor_cerimonia)}`, ...CEREMONY_INSTRUMENTS[l.formacao]].join('\n'));
  if (!blocks.length) return null;
  return [
    '🎶 Orçamentos Cerimônia 🎶',
    ...blocks,
    'As formações e instrumentos são sugestões e podem ser personalizados. Recomendamos manter pelo menos um instrumento harmônico (piano ou violão).',
    'Obs.: Som não incluso. Caso deseje sonorização conosco, podemos enviar o orçamento adicional.',
    ...(travelNote ? [travelNote] : []),
  ].join('\n\n');
}

async function consultarPrecos(ctx, { formacao, recepcao_horas: horas = 0, com_som: comSom = false, data, local } = {}) {
  // Fonte oficial: quote_price_rules (vigência pela data do evento) + faixa da LOCALIDADE (ai_service_areas,
  // Manual §4). Nunca aplica o preço da região-base a outra região: sem parametrização, sinaliza ao Owner.
  const [{ data: rules }, pricing, { data: areas }] = await Promise.all([
    ctx.supabase.from('quote_price_rules').select('category, item_key, amount, valid_from, valid_until').eq('workspace_id', ctx.workspaceId),
    loadPricing(ctx),
    ctx.supabase.from('ai_service_areas').select('*').eq('workspace_id', ctx.workspaceId),
  ]);
  if (!(rules || []).length && !pricing) return { ok: false, erro: 'precos_nao_cadastrados', orientacao: 'Diga que a equipe envia os valores.' };
  const lead = ctx.conversation?.lead_data || {};
  const iso = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
  const date = iso(data) || iso(lead.data_evento) || new Date().toISOString().slice(0, 10);
  if (formacao && !FORMATIONS.includes(normalizeFormation(formacao))) return { ok: false, erro: 'formacao_desconhecida', formacoes_validas: FORMATIONS };
  const gate = await applyLocationGate(ctx, { local: local || lead.local, cidade: lead.cidade, areas: areas || [], date, initial: true });
  if (gate.stop) return gate.stop;
  const { location } = gate;
  const tables = { rules: rules || [], pricing, areas: areas || [] };
  const regionStop = async (q, tableMode = false) => {
    const reason = !q.ok ? 'territory_blocked' : hasRegionIssue(q, { tableMode }) ? q.approvals.join(',') : q.approvals.includes('territory_conditional') ? 'territory_conditional' : null;
    if (!reason) return null;
    if (!q.ok) { if (ctx.effects) ctx.effects.needsHuman = { reason: 'territory_blocked' }; return { ok: false, erro: 'local_nao_atendido', orientacao: 'Diga com gentileza que vai verificar com a equipe a possibilidade de atender esse local.' }; }
    await flagRegionPricing({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, conversationId: ctx.conversation?.id, location, date, reason });
    if (isCustomQuote(q)) {
      if (ctx.effects) ctx.effects.regionPendingText = customQuoteMessage(location);
      return { ok: false, erro: 'orcamento_personalizado', orientacao: CUSTOM_GUIDANCE };
    }
    if (ctx.effects) ctx.effects.regionPendingText = regionPendingMessage(location);
    return { ok: false, erro: 'localidade_sem_parametrizacao', orientacao: 'Não informe valores (nem os da região-base). Se o local não deixou clara a cidade, pergunte a cidade/bairro. Se for outra região, diga com naturalidade que a equipe confirma os valores para essa localidade e já te retorna. Não pergunte nada que a cliente já informou (tipo de evento, data, local, horário).' };
  };
  const area = resolveTerritory(tables.areas, location);
  const outsideBase = Boolean(area && ((area.price_tier && area.price_tier !== 'base') || Number(area.travel_fee) > 0));
  if (!formacao) {
    // Tabela vigente na data e na faixa da localidade, só com valores OFICIAIS (pendentes não aparecem).
    const quotes = FORMATIONS.map((f) => ({ f, q: calculateQuote({ date, formation: f, location, hasSound: Boolean(comSom), reception: { hours: 0 } }, tables) }));
    // Na tabela, formação sem preço próprio na faixa só fica de fora; local sem área/condicional/bloqueado para tudo.
    const stop = await regionStop(quotes[0].q, true);
    if (stop) return stop;
    const tabela = quotes.filter(({ q }) => q.sources?.ceremony === 'quote_price_rules').map(({ f, q }) => {
      const amount = (key) => q.items.find((i) => i.key === key)?.amount ?? null;
      return { formacao: f, valor_cerimonia: amount('ceremony'), ...(comSom ? { valor_som: amount('sound') } : {}) };
    }).filter((l) => l.valor_cerimonia);
    if (!tabela.length) {
      await flagRegionPricing({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, conversationId: ctx.conversation?.id, location, date, reason: 'tabela_sem_precos' });
      // Faixa cadastrada mas sem preços (ex.: área "metro" sem regras @metro): mesma resposta fixa, sem valores.
      if (ctx.effects) ctx.effects.regionPendingText = regionPendingMessage(area?.name || location);
      return { ok: false, erro: 'localidade_sem_parametrizacao', orientacao: 'Não informe valores. A resposta fixa já informa que a equipe confirma os valores dessa localidade.' };
    }
    const baseNames = (tables.areas || []).filter((a) => a.active !== false && a.status === 'served' && (!a.price_tier || a.price_tier === 'base') && !(Number(a.travel_fee) > 0)).map((a) => a.name);
    const travelNote = outsideBase
      ? `Para eventos fora de ${baseNames.length ? baseNames.join(', ').replace(/, ([^,]*)$/, ' e $1') : 'nossa região-base'} cobramos uma taxa de locomoção.`
      : null;
    const mensagem = comSom ? null : formatCeremonyTable(tabela, { travelNote });
    if (comSom && ctx.effects) ctx.effects.quoteText = [
      'Referências de cerimônia e sonorização',
      ...tabela.map((row) => `${row.formacao}: cerimônia ${brl(row.valor_cerimonia)} · som ${typeof row.valor_som === 'number' && Number.isFinite(row.valor_som) ? brl(row.valor_som) : 'a confirmar'}`),
      'Valores de referência; proposta final e logística sujeitas à confirmação.',
    ].join('\n');
    // Texto determinístico (formato do Owner): enviado como está, igual ao resumo de fechamento.
    if (mensagem && ctx.effects) ctx.effects.quoteTableText = mensagem;
    if (ctx.conversation?.id) await persistMemory({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, conversation: ctx.conversation, updates: { ultimo_orcamento: `Tabela de cerimônia enviada — ${date}, ${area?.name || location}: ${tabela.map((l) => `${l.formacao} ${brl(l.valor_cerimonia)}`).join(', ')}` } }).catch(() => null);
    return {
      ok: true, data_referencia: date, localidade: area?.name || location, tabela,
      orientacao: 'A tabela padrão já vai como está. Não a repita. Depois, no máximo UMA pergunta leve para seguir.',
      observacao: 'Valores de referência da tabela vigente na data e na faixa da localidade, sem som, receptivo e deslocamento. Proposta final depende de aprovação da equipe.',
    };
  }
  const formation = normalizeFormation(formacao);
  if (!FORMATIONS.includes(formation)) return { ok: false, erro: 'formacao_desconhecida', formacoes_validas: FORMATIONS };
  const h = Math.max(0, Math.min(3, parseInt(horas, 10) || 0));
  const quote = calculateQuote({ date, formation, location, hasSound: Boolean(comSom), reception: { hours: h } }, tables);
  const stop = await regionStop(quote);
  if (stop) return stop;
  const item = (key) => quote.items.find((i) => i.key === key)?.amount ?? null;
  const base = item('ceremony');
  if (!base) return { ok: false, erro: 'preco_nao_cadastrado_para_formacao' };
  const somValidar = quote.approvals.includes('sound_duration_requires_validation');
  if (ctx.effects) ctx.effects.quoteText = [
    `${formation}: cerimônia ${brl(base)}`,
    ...(h ? [`Receptivo: ${item('reception') == null ? 'a confirmar' : brl(item('reception'))}`] : []),
    ...(comSom ? [`Som: ${somValidar || item('sound') == null ? 'a confirmar' : brl(item('sound'))}`] : []),
    'Valores de referência; proposta final e logística sujeitas à confirmação.',
  ].join('\n');
  return {
    ok: true,
    formacao: formation,
    data_referencia: date,
    localidade: area?.name || location,
    valor_cerimonia: base,
    valor_recepcao: h ? item('reception') : 0,
    valor_som: comSom ? item('sound') : 0,
    ...(outsideBase ? { deslocamento: 'Fora da região-base há taxa de locomoção (calcular_orcamento traz o valor).' } : {}),
    ...(somValidar ? { som_observacao: 'Som com receptivo acima de 2h é orçado sob medida: diga que a equipe confirma.' } : {}),
    observacao: 'Valores de referência da tabela vigente na data e na faixa da localidade. Proposta final depende de aprovação da equipe.',
  };
}

async function listarFormacoes(ctx) {
  const pricing = await loadPricing(ctx);
  const formacoes = pricing ? FORMATIONS.filter((f) => getAutomaticFormationPrice(f, pricing) > 0) : [];
  const { data: types } = await ctx.supabase
    .from('event_types')
    .select('name, is_active')
    .eq('workspace_id', ctx.workspaceId);
  return {
    ok: true,
    formacoes: formacoes.length ? formacoes : null,
    instrumentos_sugeridos: Object.fromEntries(formacoes.filter((f) => CEREMONY_INSTRUMENTS[f]).map((f) => [f, CEREMONY_INSTRUMENTS[f]])),
    tipos_evento: (types || []).filter((t) => t.is_active !== false).map((t) => t.name).filter(Boolean),
    observacao: formacoes.length ? undefined : 'Formações não cadastradas: a equipe confirma.',
  };
}

async function consultarMeuCadastro({ supabase, workspaceId, conversation }) {
  const tail = phoneTail(conversation?.contact_phone || conversation?.provider_chat_id);
  if (!tail) return { ok: true, encontrado: false };
  const [{ data: events }, { data: quotes }] = await Promise.all([
    supabase.from('events').select('id, event_date, event_type, formation, status, whatsapp_phone')
      .eq('workspace_id', workspaceId).ilike('whatsapp_phone', `%${tail}`).order('event_date', { ascending: false }).limit(5),
    supabase.from('quotes').select('id, event_date, event_type, formation, status, client_phone')
      .eq('workspace_id', workspaceId).ilike('client_phone', `%${tail}`).order('created_at', { ascending: false }).limit(3),
  ]);
  // Confirma o número (DDD + 8 dígitos finais; tolera o 9º dígito ausente no wa_id).
  const full = conversation?.contact_phone || conversation?.provider_chat_id;
  const same = (p) => samePhoneBR(full, p);
  const myEvents = (events || []).filter((e) => same(e.whatsapp_phone));
  const myQuotes = (quotes || []).filter((q) => same(q.client_phone));
  let contracts = [];
  if (myEvents.length) {
    const { data } = await supabase.from('contracts').select('event_id, status')
      .eq('workspace_id', workspaceId).in('event_id', myEvents.map((e) => e.id));
    contracts = data || [];
  }
  return {
    ok: true,
    encontrado: myEvents.length > 0 || myQuotes.length > 0,
    eventos: myEvents.map((e) => ({
      data: e.event_date, tipo: e.event_type, formacao: e.formation, status: e.status,
      contrato: contracts.find((c) => c.event_id === e.id)?.status || null,
    })),
    orcamentos: myQuotes.map((q) => ({ data: q.event_date, tipo: q.event_type, formacao: q.formation, status: q.status })),
  };
}

async function registrarDadosEvento({ supabase, workspaceId, conversation }, args) {
  // Memória estilo mem0 (ADD/UPDATE/DELETE) auditada em ai_memory_events.
  const result = await persistMemory({ supabase, workspaceId, conversation, updates: Object.fromEntries(Object.entries(args || {}).filter(([k]) => LEAD_FIELDS.includes(k))) });
  return { ok: !result.error, salvo: Boolean(result.changed) };
}

async function solicitarAprovacao({ supabase, workspaceId, conversation, effects }, { tipo, resumo }) {
  const kind = ['proposal', 'discount', 'contract_change', 'other'].includes(tipo) ? tipo : 'other';
  const { error } = await supabase.from('ai_approvals').insert({
    workspace_id: workspaceId,
    conversation_id: conversation.id,
    kind,
    summary: String(resumo || '').slice(0, 500) || 'Solicitação da IA',
    details: { lead: conversation.lead_data || {} },
  });
  if (error) return { ok: false, erro: 'falha_ao_registrar' };
  effects.needsHuman = effects.needsHuman || { reason: kind === 'proposal' ? 'ai_requested' : kind === 'discount' ? 'discount_request' : kind === 'contract_change' ? 'contract_change' : 'ai_requested' };
  return { ok: true, registrado: true };
}

async function transferirParaHumano(ctx, { motivo }) {
  const result = await solicitarAprovacao(ctx, { tipo: 'other', resumo: String(motivo || 'Atendimento humano solicitado').slice(0, 500) });
  if (!result.ok) return result;
  ctx.effects.needsHuman = { reason: 'ai_requested', detail: String(motivo || '').slice(0, 200) };
  return result;
}

const EXECUTORS = {
  ...COMMERCIAL_EXECUTORS,
  consultar_disponibilidade: consultarDisponibilidade,
  consultar_precos: consultarPrecos,
  listar_formacoes: listarFormacoes,
  consultar_meu_cadastro: consultarMeuCadastro,
  registrar_dados_evento: registrarDadosEvento,
  solicitar_aprovacao: solicitarAprovacao,
  transferir_para_humano: transferirParaHumano,
};

TOOL_DEFINITIONS.push(...COMMERCIAL_TOOL_DEFINITIONS);
const AVAILABILITY = TOOL_DEFINITIONS.find((t) => t.name === 'consultar_disponibilidade');
AVAILABILITY.parameters.properties.horario = { type: 'string', description: 'HH:MM, se informado' };

export async function executeTool(name, args, ctx) {
  const fn = EXECUTORS[name];
  if (!fn) return { ok: false, erro: 'ferramenta_desconhecida' };
  try {
    const result = await fn(ctx, args && typeof args === 'object' ? args : {});
    // Durable review task, independent of the final wording and without pausing
    // useful conversation about formations while regional prices are reviewed.
    if (!result?.ok && ['consultar_precos', 'calcular_orcamento'].includes(name)
      && ['localidade_sem_parametrizacao', 'orcamento_personalizado', 'precos_nao_cadastrados'].includes(result.erro || result.motivo)) {
      const lead = ctx.conversation?.lead_data || {};
      const review = await flagRegionPricing({ supabase: ctx.supabase, workspaceId: ctx.workspaceId,
        conversationId: ctx.conversation?.id, location: lead.cidade || lead.local,
        date: lead.data_evento || null, reason: 'commercial_quote_review' });
      return { ...result, registrado: Boolean(review?.registrado), receipt: review?.receipt || null };
    }
    return result;
  } catch (error) {
    console.error('[AI][TOOL][ERROR]', { tool: name, message: error?.message });
    return { ok: false, erro: 'falha_interna' };
  }
}

