/**
 * Ferramentas comerciais V2: orçamento determinístico com território, rider, vocalistas,
 * fechamento (resumo + confirmação) e pós-venda. Todas escopadas pelo workspace; nada é
 * inventado; exceções viram aprovação/transferência humana.
 */
import { quoteForWorkspace, formatBRL, parseInstruments, resolveTerritory } from '../commercial/pricing.mjs';
import { planVocalist, eligibleVocalists, createVocalistRequest, normalizeVoice } from '../commercial/vocalists.mjs';
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
  modalidade: { type: 'string', enum: ['cerimonia', 'por_tempo'], description: 'por_tempo = apresentação avulsa por horas (aniversário, coquetel, receptivo isolado)' },
  horas: { type: 'integer', description: 'Horas da apresentação por tempo (1 a 3)' },
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
    description: 'Quando a cliente quiser conhecer opções de voz. Lista SOMENTE vocalistas autorizados, com links de apresentação. Não confirma disponibilidade: a agenda é sempre confirmada pela equipe.',
    parameters: { type: 'object', properties: { data: { type: 'string' }, horario: { type: 'string' }, voz: { type: 'string', enum: ['masculina', 'feminina'] } }, additionalProperties: false },
  },
  {
    type: 'function',
    name: 'escolher_vocalista',
    description: 'Quando a cliente escolher um(a) vocalista da lista apresentada. Registra a escolha para a equipe confirmar a agenda; nada é confirmado nem enviado ao músico automaticamente.',
    parameters: { type: 'object', properties: { nome: { type: 'string' }, data: { type: 'string' }, horario: { type: 'string' } }, required: ['nome'], additionalProperties: false },
  },
  {
    type: 'function',
    name: 'preparar_fechamento',
    description: 'Quando o cliente decidir contratar: valida preço e agenda e envia o resumo obrigatório para confirmação expressa. Não escreva o resumo você mesmo.',
    parameters: { type: 'object', properties: { ...QUOTE_PARAMS, voz: { type: 'string', enum: ['masculina', 'feminina'], description: 'Voz desejada, se a cliente informou' }, vocalista_escolhido: { type: 'string', description: 'Somente se a cliente escolheu um(a) vocalista da lista' } }, required: ['data', 'formacao', 'local'], additionalProperties: false },
  },
  {
    type: 'function',
    name: 'atualizar_etapa',
    description: 'Atualiza a etapa comercial (qualifying, proposal, negotiation, lost). Para lost informe o motivo.',
    parameters: { type: 'object', properties: { etapa: { type: 'string', enum: ['qualifying', 'proposal', 'negotiation', 'lost'] }, motivo: { type: 'string' } }, required: ['etapa'], additionalProperties: false },
  },
  {
    type: 'function',
    name: 'vincular_evento',
    description: 'Quando alguém diz fazer parte de um evento já contratado (noiva, familiar, cerimonial) a partir de outro número. Pede verificação da equipe; não libera dados privados.',
    parameters: { type: 'object', properties: { nome_contratante: { type: 'string' }, data: { type: 'string', description: 'YYYY-MM-DD' }, papel: { type: 'string', enum: ['noivo', 'noiva', 'familiar', 'cerimonial', 'contratante', 'other'] } }, required: ['data'], additionalProperties: false },
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
    modality: (args.modalidade || lead.modalidade) === 'por_tempo' ? 'show' : 'ceremony',
    hours: args.horas ?? lead.horas ?? null,
    primaryVocalSings: !args.vocalista_escolhido,
  };
}

const UNRESOLVED_LABELS = {
  date_missing: 'data', formation_invalid: 'formação', ceremony_price_missing: 'valor da cerimônia',
  reception_price_missing: 'valor do receptivo', sound_price_missing: 'valor do som',
  location_missing: 'local', logistics_unresolved: 'logística/deslocamento', lodging_fee_missing: 'hospedagem',
  show_hours_missing: 'quantidade de horas', show_price_missing: 'valor por tempo', sound_custom: 'som sob medida (a equipe orça)',
};
// Exceções explicadas à cliente (sem expor regra interna): o que a equipe confirma.
const APPROVAL_NOTES = {
  sound_duration_requires_validation: 'o valor do som para receptivo acima de 2h é confirmado pela equipe',
  territory_conditional: 'a logística do local é confirmada pela equipe',
  reception_requires_ceremony: 'o receptivo adicional vale junto com a cerimônia; sozinho é orçado por tempo',
  instruments_mismatch: 'a combinação de instrumentos é confirmada pela equipe',
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
    a_confirmar_pela_equipe: quote.approvals.map((a) => APPROVAL_NOTES[a]).filter(Boolean),
  };
  if (!quote.final) out.orientacao = 'Não apresente total definitivo. Mostre os itens já calculados, explique o que fica a confirmar pela equipe e pergunte só o que falta.';
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

function voiceFromText(text) {
  const t = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/voz feminina|vocal feminin|cantora/.test(t)) return 'feminino';
  if (/voz masculina|vocal masculin|cantor\b/.test(t)) return 'masculino';
  return null;
}

function vocalTarget(ctx, args = {}) {
  const lead = ctx.conversation?.lead_data || {};
  return {
    conversation_id: ctx.conversation?.id, date: args.data || lead.data_evento || null, time: args.horario || lead.horario || null,
    duration_min: 60, reception_hours: Number(args.recepcao_horas ?? lead.recepcao_horas ?? 0) || 0,
    formation: args.formacao || lead.formacao || null, location: args.local || lead.local || lead.cidade || null,
    // Voz: informada pela cliente ou deduzida dos instrumentos ("voz feminina", "cantora"...).
    voice: normalizeVoice(args.voz || lead.voz) || voiceFromText(args.instrumentos || lead.instrumentos || ''),
  };
}

async function listarVocalistas(ctx, args = {}) {
  const target = vocalTarget(ctx, args);
  const list = await eligibleVocalists({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, settings: ctx.settings || {}, target, voice: target.voice });
  return {
    ok: true,
    vocalistas: list.map((v) => ({ nome: v.nome, voz: v.voz, links: v.links })),
    orientacao: list.length
      ? 'Apresente como opções, com os links. Diga que a agenda de quem ela escolher é confirmada pela equipe; nunca diga que alguém está disponível.'
      : 'Diga que a equipe vai indicar as opções de voz para a data.',
  };
}

async function escolherVocalista(ctx, args = {}) {
  const target = vocalTarget(ctx, args);
  if (!target.date) return { ok: false, orientacao: 'Pergunte a data do evento antes de registrar a escolha.' };
  const list = await eligibleVocalists({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, settings: ctx.settings || {}, target });
  const wanted = String(args.nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const chosen = list.find((v) => v.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(wanted));
  if (!chosen) return { ok: false, orientacao: 'Diga que vai verificar essa opção com a equipe.' };
  const plan = await planVocalist({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, settings: ctx.settings || {}, target: { ...target, voice: chosen.voz }, chosenContactId: chosen.contact_id });
  await createVocalistRequest({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, target: { ...target, voice: chosen.voz }, contactId: chosen.contact_id, reason: 'client_choice', assessment: plan.assessment });
  ctx.effects.vocalistRequested = true;
  return { ok: true, orientacao: `Agradeça a escolha e diga que vai confirmar a agenda de ${chosen.nome} com a equipe antes de garantir.` };
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
  // Vocalista (gestão comercial da assistente): prioridade do Owner vira PEDIDO para aprovação; conflito vira
  // pendência para o Owner decidir; nunca substituição automática; disponibilidade não é comentada.
  const target = { ...vocalTarget(ctx, { ...args, data: quote.date, horario: time }), reception_hours: quote.reception?.hours || 0, formation: quote.formation };
  const profiles = args.vocalista_escolhido ? await eligibleVocalists({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, settings: ctx.settings || {}, target }) : [];
  const chosen = profiles.find((p) => p.nome.toLowerCase() === String(args.vocalista_escolhido || '').toLowerCase());
  const plan = await planVocalist({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, settings: ctx.settings || {}, target: chosen ? { ...target, voice: chosen.voz } : target, chosenContactId: chosen?.contact_id || null });
  if (plan.decision === 'conflict') {
    await createVocalistRequest({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, target, contactId: plan.contactId, reason: plan.reason, assessment: plan.assessment });
    ctx.effects.needsHuman = { reason: 'availability_review' };
    return { ok: false, orientacao: 'Não fale de indisponibilidade nem cite nomes. Diga que vai confirmar a agenda da equipe e já retorna para gerar o pré-contrato.' };
  }
  if (plan.decision === 'request') {
    await createVocalistRequest({ supabase: ctx.supabase, workspaceId: ctx.workspaceId, target, contactId: plan.contactId, reason: plan.reason, assessment: plan.assessment });
  } else if (ctx.conversation?.id) {
    await ctx.supabase.from('ai_approvals').insert({ workspace_id: ctx.workspaceId, conversation_id: ctx.conversation.id, kind: 'availability_review', summary: `Definir o vocalista do evento de ${quote.date} (${quote.formation}).`, details: { vocalist: true, reason: plan.reason } });
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

async function vincularEvento(ctx, { nome_contratante: nome, data, papel = 'other' }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ''))) return { ok: false, erro: 'data_invalida' };
  const { data: events } = await ctx.supabase.from('events').select('id, client_name, event_date').eq('workspace_id', ctx.workspaceId).eq('event_date', data);
  const wanted = String(nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const candidates = (events || []).filter((e) => !wanted || String(e.client_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(wanted));
  const { data: participant } = await ctx.supabase.from('ai_conversation_participants').insert({
    workspace_id: ctx.workspaceId, conversation_id: ctx.conversation.id, role: papel, status: 'pending',
    event_id: candidates.length === 1 ? candidates[0].id : null, claimed_text: `${nome || ''} ${data}`.trim().slice(0, 200),
  }).select('id').maybeSingle();
  await ctx.supabase.from('ai_approvals').insert({
    workspace_id: ctx.workspaceId, conversation_id: ctx.conversation.id, kind: 'participant_link',
    summary: `Vincular participante (${papel}) ao evento de ${data}${candidates.length === 1 ? '' : ` — ${candidates.length} candidato(s)`}.`,
    details: { participant_id: participant?.id || null, candidate_event_ids: candidates.map((c) => c.id) },
  });
  // Nunca confirma ao cliente que o evento existe nem expõe dados: verificação é humana.
  return { ok: true, orientacao: 'Diga com gentileza que vai confirmar o vínculo com o evento para localizar o painel correto, sem citar nomes ou dados do evento.' };
}

async function obterLinkCliente(ctx) {
  const conv = ctx.conversation || {};
  // Participante verificado pela equipe com permissão de painel usa o pré-contrato do evento vinculado.
  if (!conv.precontract_id) {
    const { data: part } = await ctx.supabase.from('ai_conversation_participants').select('precontract_id, permissions')
      .eq('workspace_id', ctx.workspaceId).eq('conversation_id', conv.id).eq('status', 'verified');
    const allowed = (part || []).find((p) => p.precontract_id && (p.permissions || []).includes('panel'));
    if (allowed) conv.precontract_id = allowed.precontract_id;
  }
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
  escolher_vocalista: escolherVocalista,
  verificar_localidade: verificarLocalidade,
  consultar_rider: consultarRider,
  listar_vocalistas: listarVocalistas,
  preparar_fechamento: prepararFechamento,
  atualizar_etapa: atualizarEtapa,
  obter_link_cliente: obterLinkCliente,
  vincular_evento: vincularEvento,
};
