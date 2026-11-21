import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { buildSystemPrompt } from '@/lib/ai/agent/prompt.mjs';
import { TOOL_DEFINITIONS, executeTool } from '@/lib/ai/agent/tools.mjs';
import { runCommercialTurn, rememberInSession, NARA_ENGINE_VERSION } from '@/lib/ai/agent/conversation-turn.mjs';
import { createSimulationStore } from '@/lib/ai/commercial/simulation-store.mjs';
import { loadWorkspaceAiContext } from '@/lib/ai/inbox/service.mjs';
import { buildCommercialContext } from '@/lib/ai/commercial/engine.mjs';
import { createRoadGeoServices } from '@/lib/ai/commercial/road-location.mjs';
import { lookupVenueOnline } from '@/lib/ai/commercial/venue-online.mjs';
import { isSensitiveValue } from '@/lib/ai/commercial/memory.mjs';
import { SIMULATION_SESSIONS, isSimulationId, requestSimulationReview, updateSimulationProposal, supervisionEnabled } from '@/lib/ai/commercial/simulation-supervision.mjs';
import { runNaraV2, NARA_V2_VERSION, V2_ALLOWED } from '@/lib/ai/agent/v2.mjs';

export const dynamic = 'force-dynamic';
const ALLOWED = new Set(['listar_formacoes', 'consultar_rider', 'verificar_localidade', 'pesquisar_espaco',
  'consultar_tabela_receptivo', 'comparar_receptivo', 'consultar_precos', 'calcular_orcamento', 'registrar_dados_evento', 'solicitar_aprovacao',
  'transferir_para_humano', 'preparar_fechamento']);
const TOOLS = TOOL_DEFINITIONS.filter((t) => ALLOWED.has(t.name));

export async function POST(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][CHAT_SIMULATION]' });
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => null);
  let messages = body?.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > 40 || messages.at(-1)?.role !== 'user'
    || messages.some((m) => !['assistant', 'user'].includes(m?.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 1800)) {
    return NextResponse.json({ ok: false, error: 'Envie uma conversa de teste válida.' }, { status: 400 });
  }
  const engine = body?.engine === 'v2' ? 'v2' : 'legacy';
  const workspaceId = guard.auth.workspaceId;
  const supervised = engine === 'v2' && supervisionEnabled();
  const startedAt = Date.now();
  let saved;
  let state;
  if (supervised) {
    const content = messages.at(-1).content;
    if (!isSimulationId(body.sessionId) || !Number.isInteger(body.revision) || isSensitiveValue(content)) {
      return NextResponse.json({ ok: false, error: 'Abra uma conversa de teste e use apenas dados fictícios.' }, { status: 400 });
    }
    const session = await guard.supabase.from(SIMULATION_SESSIONS).select('revision,state')
      .eq('id', body.sessionId).eq('workspace_id', workspaceId).maybeSingle();
    if (session.error) return NextResponse.json({ ok: false, error: 'Não foi possível carregar a conversa de teste.' }, { status: 503 });
    saved = session.data;
    if ((saved?.revision ?? 0) !== body.revision) {
      return NextResponse.json({ ok: false, error: 'A conversa mudou. Aguarde a atualização e tente novamente.' }, { status: 409 });
    }
    state = saved?.state || { id: body.sessionId, messages: [], lead: {}, draft: null, closing: null };
    if (state.messages.length >= 38) return NextResponse.json({ ok: false, error: 'Limite da conversa atingido.' }, { status: 400 });
    messages = [...state.messages, { role: 'user', content }];
  }
  async function saveTurn(result, conversation, review = null) {
    if (!supervised) return null;
    const proposal = updateSimulationProposal(state, conversation.lead_data, conversation.simulation_closing, review);
    const newState = { ...state, ...proposal, lead: conversation.lead_data, draft: review ? null : conversation.simulation_closing,
      messages: [...messages, { role: 'assistant', content: result.text }] };
    const values = { revision: body.revision + 1, state: newState, updated_at: new Date().toISOString() };
    const query = saved
      ? guard.supabase.from(SIMULATION_SESSIONS).update(values).eq('id', state.id).eq('workspace_id', workspaceId).eq('revision', body.revision)
      : guard.supabase.from(SIMULATION_SESSIONS).insert({ ...values, id: state.id, workspace_id: workspaceId, created_by: guard.auth.userId });
    const { data, error } = await query.select('id').maybeSingle();
    if (error || !data) return NextResponse.json({ ok: false, error: 'Não foi possível salvar este turno. Atualize a conversa e tente novamente.' }, { status: 409 });
    return newState;
  }
  try {
    if (supervised) {
      const review = requestSimulationReview(state.draft, state.lead, state.messages.at(-1)?.content, messages.at(-1).content);
      if (review) {
        const result = { text: 'Obrigada por confirmar! O resumo foi registrado e aguarda a aprovação da equipe. Assim que ela aprovar, continuo por aqui.' };
        const persisted = await saveTurn(result, { lead_data: state.lead }, review);
        if (persisted instanceof Response) return persisted;
        return NextResponse.json({ ok: true, reply: result.text, lead: state.lead,
          session: { id: state.id, revision: body.revision + 1, state: persisted },
          diagnostic: { intent: 'awaiting_approval', simulated: true } }, { headers: { 'Cache-Control': 'no-store' } });
      }
    }
    const context = await loadWorkspaceAiContext(guard.supabase, workspaceId);
    // Only approved commercial reference data; no client, contact or event reads.
    const names = ['quote_price_rules', 'ai_service_areas', 'pricing_settings', 'ai_venues', 'event_types', 'ai_knowledge_items'];
    const loaded = await Promise.all(names.map(async (table) => {
      let q = guard.supabase.from(table).select('*').eq('workspace_id', workspaceId);
      if (table === 'ai_venues') q = q.eq('status', 'verified');
      if (table === 'ai_knowledge_items') q = q.eq('status', 'active');
      const result = await q;
      if (result.error) throw new Error('simulation_reference_unavailable');
      return [table, result.data || []];
    }));
    // The latest message is interpreted by the same semantic tool as WhatsApp;
    // no regex replay of old messages can resurrect a corrected venue.
    const conversation = { id: 'simulation', workspace_id: workspaceId, supervisedSimulation: supervised,
      lead_data: supervised ? state.lead : body?.lead && typeof body.lead === 'object' && !Array.isArray(body.lead) ? body.lead : {},
      simulation_closing: supervised ? state.draft : body?.simulationClosing || null, sales_stage: 'qualifying', memory_summary: '' };
    const reference = Object.fromEntries(loaded);
    const local = createSimulationStore({ ...reference, ai_conversations: [conversation] });
    const effects = {};
    const roadGeo = engine === 'v2' ? createRoadGeoServices() : null;
    const loadCommercial = () => buildCommercialContext({ supabase: local, workspaceId, conversation,
      latestText: messages.at(-1).content, settings: context.settings, customerStatus: 'lead',
      referenceKnowledge: engine === 'v2' ? reference.ai_knowledge_items : undefined });
    const commercial = engine === 'legacy' ? await loadCommercial() : null;
    const sandboxExecute = async (name, args) => {
      if (!(engine === 'v2' ? V2_ALLOWED.includes(name) : ALLOWED.has(name))) return { ok: false };
      const before = local.writes.length;
      const raw = await executeTool(name, args, { supabase: local, workspaceId, conversation, effects,
        settings: context.settings || {}, simulated: true, ownerVersion: 0,
        roadGeo, geoSupabase: guard.supabase, venueWebSearchFn: roadGeo?.webSearch, venueSearchFn: process.env.CI
          ? async () => ({ status: 'unavailable' }) : lookupVenueOnline });
      return { ...raw, ...(raw?.registrado || (raw?.ok && ['preparar_fechamento'].includes(name) && local.writes.length > before)
        ? { registrado: true, simulated: true } : {}) };
    };
    const result = engine === 'v2'
      ? await runNaraV2({ input: messages, conversation, loadCommercial, effects,
          settings: context.settings || {}, companyName: context.companyName,
          execute: sandboxExecute, simulated: true })
      : await runCommercialTurn({
      system: buildSystemPrompt({ settings: context.settings || {}, companyName: context.companyName, conversation,
        isFirstAiReply: !messages.some((m) => m.role === 'assistant'), knowledge: commercial.knowledgeText })
        + '\nAMBIENTE DE TESTE: ações ficam apenas na memória temporária. Se houver registrado=true com simulated=true, explique que o encaminhamento é simulado; não afirme envio real. Mesmo após CONFIRMO, nenhum pré-contrato, reserva ou link real pode ser criado ou enviado neste chat. Não peça confirmação para gerar documento real. Pesquisa pública gratuita de espaços está conectada; não use busca paga.',
      input: messages, tools: TOOLS, conversation, effects, simulated: true, repertoireEvidence: commercial.repertoireEvidence,
      remember: (updates) => rememberInSession(conversation, updates),
      execute: sandboxExecute,
    });
    const persisted = await saveTurn(result, conversation);
    if (persisted instanceof Response) return persisted;
    return NextResponse.json({ ok: true, reply: result.text,
      ...(supervised ? { session: { id: state.id, revision: body.revision + 1, state: persisted } } : {}), lead: conversation.lead_data, simulationClosing: conversation.simulation_closing || null,
      diagnostic: { engineVersion: result.engineVersion || (engine === 'v2' ? NARA_V2_VERSION : NARA_ENGINE_VERSION),
        engine, intent: result.intent, toolCalls: result.toolCalls,
        results: result.diagnostics, model: result.model, costUsd: result.costUsd,
        inputTokens: result.inputTokens, outputTokens: result.outputTokens, latencyMs: Date.now() - startedAt, simulated: true,
        geography: effects.roadGeo || (engine === 'v2' ? {
          status: !roadGeo ? 'disabled' : !roadGeo.search || !roadGeo.provider ? 'provider_missing' : 'not_used',
          cache: 'not_used', calls: [],
        } : undefined), webSearchStatus: effects.venueSearchStatus || 'nao_necessaria', receipts: result.receipts } },
    { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[AI][CHAT_SIMULATION][ERROR]', { code: error?.message });
    return NextResponse.json({ ok: false, error: 'Não foi possível concluir esta resposta da Nara. Tente novamente.', diagnostic: { engineVersion: engine === 'v2' ? NARA_V2_VERSION : NARA_ENGINE_VERSION, errorCode: /^(?:commercial_[a-z_]+|llm_http_\d{3}|llm_not_configured)$/.test(error?.message || '') ? error.message : 'commercial_turn_failed', costUsd: error?.usage?.costUsd ?? null, latencyMs: Date.now() - startedAt, simulated: true } }, { status: 503 });
  }
}
