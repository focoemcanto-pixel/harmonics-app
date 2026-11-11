import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { buildSystemPrompt } from '@/lib/ai/agent/prompt.mjs';
import { TOOL_DEFINITIONS, executeTool } from '@/lib/ai/agent/tools.mjs';
import { runCommercialTurn, rememberInSession, NARA_ENGINE_VERSION } from '@/lib/ai/agent/conversation-turn.mjs';
import { createSimulationStore } from '@/lib/ai/commercial/simulation-store.mjs';
import { loadWorkspaceAiContext } from '@/lib/ai/inbox/service.mjs';
import { buildCommercialContext } from '@/lib/ai/commercial/engine.mjs';
import { lookupVenueOnline } from '@/lib/ai/commercial/venue-online.mjs';

export const dynamic = 'force-dynamic';
const ALLOWED = new Set(['listar_formacoes', 'consultar_rider', 'verificar_localidade', 'pesquisar_espaco',
  'comparar_receptivo', 'consultar_precos', 'calcular_orcamento', 'registrar_dados_evento', 'solicitar_aprovacao',
  'transferir_para_humano', 'preparar_fechamento']);
const TOOLS = TOOL_DEFINITIONS.filter((t) => ALLOWED.has(t.name));

export async function POST(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][CHAT_SIMULATION]' });
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => null);
  const messages = body?.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > 40 || messages.at(-1)?.role !== 'user'
    || messages.some((m) => !['assistant', 'user'].includes(m?.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 1800)) {
    return NextResponse.json({ ok: false, error: 'Envie uma conversa de teste válida.' }, { status: 400 });
  }
  const workspaceId = guard.auth.workspaceId;
  const startedAt = Date.now();
  try {
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
    const conversation = { id: 'simulation', workspace_id: workspaceId,
      lead_data: body?.lead && typeof body.lead === 'object' && !Array.isArray(body.lead) ? body.lead : {},
      simulation_closing: body?.simulationClosing || null, sales_stage: 'qualifying', memory_summary: '' };
    const local = createSimulationStore({ ...Object.fromEntries(loaded), ai_conversations: [conversation] });
    const effects = {};
    const commercial = await buildCommercialContext({ supabase: local, workspaceId, conversation,
      latestText: messages.at(-1).content, settings: context.settings, customerStatus: 'lead' });
    const result = await runCommercialTurn({
      system: buildSystemPrompt({ settings: context.settings || {}, companyName: context.companyName, conversation,
        isFirstAiReply: !messages.some((m) => m.role === 'assistant'), knowledge: commercial.knowledgeText })
        + '\nAMBIENTE DE TESTE: ações ficam apenas na memória temporária. Se houver registrado=true com simulated=true, explique que o encaminhamento é simulado; não afirme envio real. Mesmo após CONFIRMO, nenhum pré-contrato, reserva ou link real pode ser criado ou enviado neste chat. Não peça confirmação para gerar documento real. Pesquisa pública gratuita de espaços está conectada; não use busca paga.',
      input: messages, tools: TOOLS, conversation, effects, simulated: true, repertoireEvidence: commercial.repertoireEvidence,
      remember: (updates) => rememberInSession(conversation, updates),
      execute: async (name, args) => {
        if (!ALLOWED.has(name)) return { ok: false };
        const before = local.writes.length;
        const raw = await executeTool(name, args, { supabase: local, workspaceId, conversation, effects,
          settings: context.settings || {}, simulated: true, ownerVersion: 0, venueSearchFn: process.env.CI
            ? async () => ({ status: 'unavailable' }) : lookupVenueOnline });
        return { ...raw, ...(raw?.registrado || (raw?.ok && ['preparar_fechamento'].includes(name) && local.writes.length > before)
          ? { registrado: true, simulated: true } : {}) };
      },
    });
    return NextResponse.json({ ok: true, reply: result.text, lead: conversation.lead_data, simulationClosing: conversation.simulation_closing || null,
      diagnostic: { engineVersion: NARA_ENGINE_VERSION, intent: result.intent, toolCalls: result.toolCalls,
        results: result.diagnostics, model: result.model, costUsd: result.costUsd,
        inputTokens: result.inputTokens, outputTokens: result.outputTokens, latencyMs: Date.now() - startedAt, simulated: true,
        webSearchStatus: effects.venueSearchStatus || 'nao_necessaria', receipts: result.receipts } },
    { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[AI][CHAT_SIMULATION][ERROR]', { code: error?.message });
    return NextResponse.json({ ok: false, error: 'Não foi possível concluir esta resposta da Nara. Tente novamente.', diagnostic: { engineVersion: NARA_ENGINE_VERSION, errorCode: /^(?:commercial_[a-z_]+|llm_http_\d{3}|llm_not_configured)$/.test(error?.message || '') ? error.message : 'commercial_turn_failed', costUsd: error?.usage?.costUsd ?? null, latencyMs: Date.now() - startedAt, simulated: true } }, { status: 503 });
  }
}
