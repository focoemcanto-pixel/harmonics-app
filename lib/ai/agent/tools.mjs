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
import { calculateQuote } from '../commercial/pricing.mjs';

const FORMATIONS = ['Solo', 'Duo', 'Trio', 'Quarteto', 'Quinteto', 'Sexteto', 'Septeto'];
const CANCELLED_EVENT = ['cancelado', 'cancelada', 'cancelled', 'canceled'];
const LEAD_FIELDS = MEMORY_FIELDS;

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
    description: 'Valores de referência oficiais (tabela vigente na data do evento) para formação, recepção e som. Use antes de citar qualquer valor.',
    parameters: {
      type: 'object',
      properties: {
        formacao: { type: 'string', description: 'Solo, Duo, Trio, Quarteto, Quinteto, Sexteto ou Septeto' },
        recepcao_horas: { type: 'integer', description: 'Horas de recepção (0 a 3)' },
        com_som: { type: 'boolean' },
        data: { type: 'string', description: 'Data do evento AAAA-MM-DD (define a tabela vigente). Se omitida, usa a data já informada ou hoje.' },
      },
      required: ['formacao'],
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
      : 'Já existe evento registrado nesta data; a equipe confirma se é possível atender.',
    orientacao: 'Nunca diga que a data ou alguém está "disponível". Diga que a equipe confirma a agenda e que a data só fica garantida com o contrato.',
  };
}

async function loadPricing({ supabase, workspaceId }) {
  // Só a linha do workspace: nunca o padrão legado nem valores default de código.
  const { data, error } = await supabase.from('pricing_settings').select('*').eq('workspace_id', workspaceId).maybeSingle();
  if (error || !data) return null;
  return data;
}

async function consultarPrecos(ctx, { formacao, recepcao_horas: horas = 0, com_som: comSom = false, data } = {}) {
  // Fonte oficial: quote_price_rules (vigência pela data do evento), igual ao calcular_orcamento e ao
  // módulo Orçamentos. A tabela do módulo Eventos (pricing_settings) só cobre itens sem regra oficial.
  const [{ data: rules }, pricing] = await Promise.all([
    ctx.supabase.from('quote_price_rules').select('category, item_key, amount, valid_from, valid_until').eq('workspace_id', ctx.workspaceId),
    loadPricing(ctx),
  ]);
  if (!(rules || []).length && !pricing) return { ok: false, erro: 'precos_nao_cadastrados', orientacao: 'Diga que a equipe envia os valores.' };
  const formation = normalizeFormation(formacao);
  if (!FORMATIONS.includes(formation)) return { ok: false, erro: 'formacao_desconhecida', formacoes_validas: FORMATIONS };
  const iso = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
  const date = iso(data) || iso(ctx.conversation?.lead_data?.data_evento) || new Date().toISOString().slice(0, 10);
  const h = Math.max(0, Math.min(3, parseInt(horas, 10) || 0));
  const quote = calculateQuote({ date, formation, hasSound: Boolean(comSom), reception: { hours: h } }, { rules: rules || [], pricing, areas: [] });
  const item = (key) => quote.items.find((i) => i.key === key)?.amount ?? null;
  const base = item('ceremony');
  if (!base) return { ok: false, erro: 'preco_nao_cadastrado_para_formacao' };
  const somValidar = quote.approvals.includes('sound_duration_requires_validation');
  return {
    ok: true,
    formacao: formation,
    data_referencia: date,
    valor_cerimonia: base,
    valor_recepcao: h ? item('reception') : 0,
    valor_som: comSom ? item('sound') : 0,
    ...(somValidar ? { som_observacao: 'Som com receptivo acima de 2h é orçado sob medida: diga que a equipe confirma.' } : {}),
    observacao: 'Valores de referência da tabela vigente na data, sem logística/deslocamento. Proposta final depende de aprovação da equipe.',
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
  const result = await persistMemory({ supabase, workspaceId, conversation, updates: args || {} });
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
  return { ok: true, orientacao: 'Diga ao cliente que a equipe vai confirmar e retornar por aqui. Não prometa valores finais.' };
}

async function transferirParaHumano({ effects }, { motivo }) {
  effects.needsHuman = { reason: 'ai_requested', detail: String(motivo || '').slice(0, 200) };
  return { ok: true, orientacao: 'Avise com uma frase curta que alguém da equipe continuará o atendimento.' };
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
    return await fn(ctx, args && typeof args === 'object' ? args : {});
  } catch (error) {
    console.error('[AI][TOOL][ERROR]', { tool: name, message: error?.message });
    return { ok: false, erro: 'falha_interna' };
  }
}
