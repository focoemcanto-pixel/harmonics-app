/**
 * Ferramentas comerciais V2: orçamento determinístico com território, rider, vocalistas,
 * fechamento (resumo + confirmação) e pós-venda. Todas escopadas pelo workspace; nada é
 * inventado; exceções viram aprovação/transferência humana.
 */
import { quoteForWorkspace, formatBRL, parseInstruments, resolveTerritory } from '../commercial/pricing.mjs';
import { checkPrimaryVocal, checkMusician } from '../commercial/schedule.mjs';
import { buildClosingSummary, renderSummaryText, hashSummary, appBaseUrl } from '../commercial/closing.mjs';

const QUOTE_PARAMS = {
  data: { type: 'string', description: 'YYYY-MM-DD' },
  horario: { type: 'string', description: 'HH:MM da cerimônia, se informado' },
  formacao: { type: 'string', description: 'Solo, Duo, Trio, Quarteto, Quinteto, Sexteto ou Septeto' },
  instrumentos: { type: 'string', description: 'Instrumentos da cerimônia separados por vírgula' },
  com_som: { type: 'boolean' },
  recepcao_formacao: { type: 'string' },
  recepcao_instrumentos: { type: 'string' },
  recepcao_horas: { type: 'integer', description: '0 a 3' },
  local: { type: 'string', description: 'Cidade/local do evento' },
};

export const COMMERCIAL_TOOL_DEFINITIONS = [
  {
    type: 'function',
    name: 'calcular_orcamento',
    description: 'Calcula o valor pela tabela oficial (formação, receptivo, som, território e logística). Use antes de citar qualquer total.',
    parameters: { type: 'object', properties: QUOTE_PARAMS, required: ['formacao'], additionalProperties: false },
  },
  {
    type: 'function',
    name: 'verificar_localidade',
    description: 'Verifica se a cidade/local é atendido, condicional ou não atendido.',
    parameters: { type: 'object', properties: { local: { type: 'string' } }, required: ['local'], additionalProperties: false },
  },
  {
    type: 'function',
    name: 'consultar_rider',
    description: 'Rider técnico cadastrado por formação/serviço (equipamentos, energia, cobertura, responsabilidades).',
    parameters: { type: 'object', properties: { formacao: { type: 'string' }, servico: { type: 'string', enum: ['cerimonia', 'receptivo'] } }, additionalProperties: false },
  },
  {
    type: 'function',
    name: 'listar_vocalistas',
    description: 'SOMENTE se o cliente pedir explicitamente outras opções de voz. Lista vocalistas com vídeos e disponibilidade verificada.',
    parameters: { type: 'object', properties: { data: { type: 'string' }, horario: { type: 'string' } }, additionalProperties: false },
  },
  {
    type: 'function',
    name: 'preparar_fechamento',
    description: 'Quando o cliente decidir contratar: valida preço e agenda e envia o resumo obrigatório para confirmação expressa. Não escreva o resumo você mesmo.',
    parameters: { type: 'object', properties: { ...QUOTE_PARAMS, vocalista_escolhido: { type: 'string', description: 'Somente se o cliente escolheu um substituto' } }, required: ['data', 'formacao', 'local'], additionalProperties: false },
  },
  {
    type: 'function',
    name: 'atualizar_etapa',
    description: 'Atualiza a etapa comercial (qualifying, proposal, negotiation, lost). Para lost informe o motivo.',
    parameters: { type: 'object', properties: { etapa: { type: 'string', enum: ['qualifying', 'proposal', 'negotiation', 'lost'] }, motivo: { type: 'string' } }, required: ['etapa'], additionalProperties: false },
  },
  {
    type: 'function',
    name: 'obter_link_cliente',
    description: 'Link individual do painel do cliente CONTRATADO (repertório, pagamentos, comprovantes). Não existe para interessados.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
];

function quoteInput(args = {}, lead = {}) {
  return {
    date: args.data || lead.data_evento || null,
    formation: args.formacao || lead.formacao || null,
    instruments: args.instrumentos || lead.instrumentos || '',
    hasSound: typeof args.com_som === 'boolean' ? args.com_som : /^(sim|true|com)/i.test(String(lead.som || '')),
    reception: { formation: args.recepcao_formacao || lead.recepcao_formacao || null, hours: args.recepcao_horas ?? lead.recepcao_horas ?? 0, instruments: args.recepcao_instrumentos || lead.recepcao_instrumentos || '' },
    location: args.local || lead.local || lead.cidade || null,
  };
}

const UNRESOLVED_LABELS = {
  date_missing: 'data', formation_invalid: 'formação', ceremony_price_missing: 'valor da cerimônia',
  reception_price_missing: 'valor do receptivo', sound_price_missing: 'valor do som',
  location_missing: 'local', logistics_unresolved: 'logística/deslocamento', lodging_fee_missing: 'hospedagem',
};

async function calcularOrcamento(ctx, args) {
  const quote = await quoteForWorkspace({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, input: quoteInput(args, ctx.conversation?.lead_data), settings: ctx.settings, routeFn: ctx.routeFn });
  if (!quote.ok) {
    ctx.effects.needsHuman = { reason: 'territory_blocked' };
    return { ok: false, motivo: 'local_nao_atendido', orientacao: 'Diga com gentileza que vai verificar com a equipe a possibilidade de atender esse local.' };
  }
  ctx.effects.lastQuote = quote;
  const out = {
    ok: true,
    itens: quote.items.map((i) => `${i.label}: ${formatBRL(i.amount)}`),
    total: quote.final ? formatBRL(quote.total) : null,
    parcial: quote.final ? undefined : formatBRL(quote.total),
    pendencias: quote.unresolved.map((u) => UNRESOLVED_LABELS[u] || u),
    requer_aprovacao: quote.approvals.length > 0,
  };
  if (!quote.final) out.orientacao = 'Não apresente total definitivo. Pergunte o que falta (pendências) ou diga que a equipe confirma o valor final.';
  if (quote.approvals.length) {
    await ctx.supabase.from('ai_approvals').insert({ workspace_id: ctx.workspaceId, conversation_id: ctx.conversation.id, kind: 'pricing_exception', summary: `Orçamento com exceção: ${quote.approvals.join(', ')}`, details: { quote } });
  }
  return out;
}

async function verificarLocalidade(ctx, { local }) {
  const { data: areas } = await ctx.supabase.from('ai_service_areas').select('*').eq('workspace_id', ctx.workspaceId);
  const area = resolveTerritory(areas || [], local);
  if (!area) return { ok: true, status: 'nao_cadastrado', orientacao: 'Não afirme que atende nem que não atende; diga que a equipe confirma a logística.' };
  if (area.status === 'blocked') { ctx.effects.needsHuman = { reason: 'territory_blocked' }; return { ok: true, status: 'nao_atendido', orientacao: 'Diga que vai verificar com a equipe.' }; }
  return { ok: true, status: area.status === 'served' ? 'atendido' : 'condicional', area: area.name, observacao: area.notes || undefined };
}

async function consultarRider(ctx, { formacao, servico }) {
  const { data } = await ctx.supabase.from('ai_knowledge_items').select('title, content, metadata')
    .eq('workspace_id', ctx.workspaceId).eq('kind', 'rider').eq('status', 'active');
  const f = String(formacao || ctx.conversation?.lead_data?.formacao || '').toLowerCase();
  const s = servico || 'cerimonia';
  const match = (data || []).filter((r) => (!r.metadata?.formation || String(r.metadata.formation).toLowerCase() === f)
    && (!r.metadata?.service || r.metadata.service === s));
  if (!match.length) return { ok: false, orientacao: 'Rider não cadastrado para essa formação: diga que a equipe envia os detalhes técnicos.' };
  return { ok: true, rider: match.slice(0, 2).map((r) => `${r.title}: ${r.content}`) };
}

async function listarVocalistas(ctx, args) {
  const lead = ctx.conversation?.lead_data || {};
  const date = args.data || lead.data_evento;
  const { data: profiles } = await ctx.supabase.from('ai_musician_profiles').select('*').eq('workspace_id', ctx.workspaceId).eq('active', true);
  const vocals = (profiles || []).filter((p) => (p.roles || []).some((r) => /vocal|voz/i.test(r)));
  const out = [];
  for (const v of vocals) {
    let status = 'sem_data';
    if (date) status = (await checkMusician({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, profile: v, request: { date, time: args.horario || lead.horario, durationMin: 60, bufferMin: ctx.settings?.schedule_buffer_minutes } })).status;
    if (date && status !== 'available') continue; // nunca oferecer quem não está verificado
    out.push({ nome: v.display_name, videos: (v.video_urls || []).slice(0, 2), portfolio: v.portfolio_url || undefined, principal: v.is_primary_vocal || undefined });
  }
  return { ok: true, vocalistas: out, orientacao: out.length ? undefined : 'Diga que a equipe vai indicar as opções disponíveis.' };
}

async function prepararFechamento(ctx, args) {
  const lead = ctx.conversation?.lead_data || {};
  const input = quoteInput(args, lead);
  const quote = await quoteForWorkspace({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, input, settings: ctx.settings, routeFn: ctx.routeFn });
  if (!quote.ok || !quote.final) {
    await ctx.supabase.from('ai_approvals').insert({ workspace_id: ctx.workspaceId, conversation_id: ctx.conversation.id, kind: 'closing', summary: 'Cliente quer contratar; orçamento precisa de revisão humana.', details: { quote, input } });
    ctx.effects.needsHuman = { reason: quote.ok ? 'pricing_exception' : 'territory_blocked' };
    return { ok: false, orientacao: 'Agradeça a decisão e diga que a equipe vai finalizar os detalhes e enviar o pré-contrato em seguida.' };
  }
  const time = args.horario || lead.horario || null;
  const musicians = [];
  const request = { date: quote.date, time, durationMin: 60, bufferMin: ctx.settings?.schedule_buffer_minutes };
  if (args.vocalista_escolhido) {
    const { data: profiles } = await ctx.supabase.from('ai_musician_profiles').select('*').eq('workspace_id', ctx.workspaceId).eq('active', true);
    const chosen = (profiles || []).find((p) => p.display_name.toLowerCase() === String(args.vocalista_escolhido).toLowerCase());
    const status = chosen ? (await checkMusician({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, profile: chosen, request })).status : 'review';
    if (status !== 'available') {
      ctx.effects.needsHuman = { reason: 'availability_review' };
      return { ok: false, orientacao: 'Diga que vai confirmar a agenda com a equipe antes de gerar o pré-contrato.' };
    }
    musicians.push({ role: 'Voz', name: chosen.display_name });
  } else if (/voz|vocal|cantor|cantora/i.test(parseInstruments(input.instruments).join(' '))) {
    const vocal = await checkPrimaryVocal({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, request });
    if (vocal.status !== 'available') {
      await ctx.supabase.from('ai_approvals').insert({ workspace_id: ctx.workspaceId, conversation_id: ctx.conversation.id, kind: 'availability_review', summary: `Agenda do vocalista principal ${vocal.status === 'conflict' ? 'em conflito' : 'inconclusiva'} para ${quote.date}.`, details: { reasons: vocal.reasons } });
      ctx.effects.needsHuman = { reason: 'availability_review' };
      return { ok: false, orientacao: 'Não fale de indisponibilidade. Diga que vai confirmar a agenda da equipe e já retorna para gerar o pré-contrato.' };
    }
    if (vocal.primary) musicians.push({ role: 'Voz', name: vocal.primary.name });
  }
  const summary = buildClosingSummary(quote, { time, location: input.location, musicians });
  const text = renderSummaryText(summary);
  const hash = await hashSummary(summary);
  const { data: closingId, error } = await ctx.supabase.rpc('ai_open_closing', {
    p_workspace_id: ctx.workspaceId, p_conversation_id: ctx.conversation.id, p_expected_owner_version: ctx.ownerVersion,
    p_summary: summary, p_summary_text: text, p_summary_hash: hash,
  });
  if (error || !closingId) return { ok: false, orientacao: 'Diga que vai conferir os detalhes e retorna em instantes.' };
  ctx.effects.closingSummaryText = text;
  ctx.effects.stage = 'closing';
  return { ok: true, orientacao: 'O resumo será enviado automaticamente ao cliente. Não escreva outra mensagem.' };
}

async function atualizarEtapa(ctx, { etapa, motivo }) {
  if (!['qualifying', 'proposal', 'negotiation', 'lost'].includes(etapa)) return { ok: false };
  ctx.effects.stage = etapa;
  ctx.effects.stageReason = motivo ? String(motivo).slice(0, 200) : null;
  return { ok: true };
}

async function obterLinkCliente(ctx) {
  const conv = ctx.conversation || {};
  const base = ctx.clientPanelBaseUrl || appBaseUrl();
  let precontract = null;
  if (conv.precontract_id) {
    const { data } = await ctx.supabase.from('precontracts').select('id, status, public_token')
      .eq('id', conv.precontract_id).eq('workspace_id', ctx.workspaceId).maybeSingle();
    precontract = data;
  }
  if (!precontract?.public_token || !['signed', 'assinado'].includes(String(precontract.status))) {
    const { data: contract } = precontract?.id
      ? await ctx.supabase.from('contracts').select('status, signed_at').eq('precontract_id', precontract.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
      : { data: null };
    if (!precontract?.public_token || !(contract?.status === 'signed' || contract?.signed_at)) {
      return { ok: false, cliente_contratado: false, orientacao: 'Ainda não há contrato assinado vinculado a este número: não envie links; ofereça ajuda ou chame a equipe.' };
    }
  }
  return { ok: true, cliente_contratado: true, link: `${base.replace(/\/+$/, '')}/cliente/${encodeURIComponent(precontract.public_token)}` };
}

export const COMMERCIAL_EXECUTORS = {
  calcular_orcamento: calcularOrcamento,
  verificar_localidade: verificarLocalidade,
  consultar_rider: consultarRider,
  listar_vocalistas: listarVocalistas,
  preparar_fechamento: prepararFechamento,
  atualizar_etapa: atualizarEtapa,
  obter_link_cliente: obterLinkCliente,
};
