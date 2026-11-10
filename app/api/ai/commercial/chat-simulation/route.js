import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { generateReply } from '@/lib/ai/agent/llm.mjs';
import { buildSystemPrompt, buildConversationInput, ensureFirstContactIntro } from '@/lib/ai/agent/prompt.mjs';
import { TOOL_DEFINITIONS, formatCeremonyTable } from '@/lib/ai/agent/tools.mjs';
import { calculateQuote, hasRegionIssue, formatBRL } from '@/lib/ai/commercial/pricing.mjs';
import { locationGate } from '@/lib/ai/commercial/geo.mjs';
import { normalizeFormation } from '@/lib/eventos/eventos-finance';
import { loadWorkspaceAiContext } from '@/lib/ai/inbox/service.mjs';

export const dynamic = 'force-dynamic';

// A simulação usa o mesmo modelo, prompt, ferramentas declaradas e calculadora da Nara.
// As ferramentas são adaptadas para SOMENTE LEITURA. Não cria conversas,
// leads, memórias, pendências, envios, contratos, cobranças ou eventos.
const ALLOWED = new Set(['verificar_localidade', 'consultar_precos', 'calcular_orcamento', 'registrar_dados_evento', 'solicitar_aprovacao', 'transferir_para_humano']);
const TOOLS = TOOL_DEFINITIONS.filter((t) => ALLOWED.has(t.name));
const MAX_MESSAGES = 24;
const MAX_TEXT = 1200;
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const dateNow = () => new Date().toISOString().slice(0, 10);

function normalizeMessages(input) {
  if (!Array.isArray(input) || input.length > MAX_MESSAGES) return null;
  const messages = input.map((m) => ({
    role: m?.role === 'assistant' ? 'assistant' : m?.role === 'user' ? 'user' : null,
    content: typeof m?.content === 'string' ? m.content.trim().slice(0, MAX_TEXT + 1) : '',
  }));
  return messages.length && messages.every((m) => m.role && m.content && m.content.length <= MAX_TEXT) ? messages : null;
}
function eventData(raw) {
  const fields = ['tipo_evento', 'data_evento', 'horario', 'local', 'cidade', 'formacao', 'instrumentos', 'som', 'recepcao_formacao', 'recepcao_horas'];
  const data = {};
  for (const key of fields) if (typeof raw?.[key] === 'string') data[key] = raw[key].slice(0, 150);
  return data;
}
function briefQuote(q) {
  return {
    ok: q.ok, final: q.final, formacao: q.formation, itens: (q.items || []).map((i) => ({ nome: i.label, valor: formatBRL(i.amount) })),
    total: q.final && !hasRegionIssue(q) ? formatBRL(q.total) : null,
    pendencias: q.unresolved || [], requer_aprovacao: q.approvals || [],
    orientacao: hasRegionIssue(q) ? 'Não informe valores. A equipe confirma a região e o orçamento.' : q.final ? 'Valor de referência, não confirme reserva.' : 'Não informe um total definitivo.',
  };
}

export async function POST(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][CHAT_SIMULATION]' });
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => null);
  const messages = normalizeMessages(body?.messages);
  if (!messages || messages.at(-1).role !== 'user') {
    return NextResponse.json({ ok: false, error: 'Envie uma mensagem de teste válida (máximo de 24 mensagens).' }, { status: 400 });
  }
  const ws = guard.auth.workspaceId;
  const context = await loadWorkspaceAiContext(guard.supabase, ws);
  const [{ data: rules, error: priceError }, { data: areas, error: areaError }, { data: pricing }, { data: venues }] = await Promise.all([
    guard.supabase.from('quote_price_rules').select('category,item_key,amount,valid_from,valid_until').eq('workspace_id', ws),
    guard.supabase.from('ai_service_areas').select('*').eq('workspace_id', ws),
    guard.supabase.from('pricing_settings').select('*').eq('workspace_id', ws).maybeSingle(),
    guard.supabase.from('ai_venues').select('*').eq('workspace_id', ws).eq('status', 'verified'),
  ]);
  if (priceError || areaError) return NextResponse.json({ ok: false, error: 'Não foi possível consultar as tabelas comerciais.' }, { status: 503 });
  const lead = eventData(body?.lead || {});
  const simulated = { lead_data: lead, sales_stage: 'qualifying', memory_summary: '', id: null };
  const effects = { toolResults: [] };
  const tables = { rules: rules || [], areas: areas || [], pricing, logisticsRules: context.settings?.logistics_rules || {}, minMarginPct: context.settings?.min_margin_pct ?? null };
  const place = (args) => String(args?.local || lead.local || lead.cidade || '').trim();
  const geo = (args) => locationGate({ local: place(args), cidade: String(args?.cidade || lead.cidade || ''), areas: areas || [], venues: venues || [] });
  const date = (args) => isIso(args?.data) ? args.data : isIso(lead.data_evento) ? lead.data_evento : dateNow();
  function quote(args) {
    const g = geo(args);
    if (g.action !== 'proceed') return { gate: g };
    return { gate: g, quote: calculateQuote({
      date: date(args), location: g.location, formation: args.formacao || lead.formacao,
      instruments: args.instrumentos || lead.instrumentos || '',
      hasSound: args.com_som === true, reception: { hours: args.recepcao_horas || 0, formation: args.recepcao_formacao || '' },
    }, tables) };
  }
  async function executeTool(name, args = {}) {
    let result;
    if (name === 'registrar_dados_evento') {
      Object.assign(lead, eventData(args));
      result = { ok: true, salvo: true, observacao: 'Memória apenas nesta simulação; nenhum dado foi gravado.' };
    } else if (name === 'verificar_localidade') {
      const g = geo(args);
      result = { ok: true, status: g.action === 'ask' ? 'cidade_necessaria' : g.action === 'proceed' ? 'identificada' : g.action === 'custom' ? 'orcamento_personalizado' : 'sem_cadastro', orientacao: g.text || (g.action === 'proceed' ? 'Local identificado. Consulte os preços oficiais antes de citá-los.' : 'Peça somente o dado ausente; não informe valores.'), local: g.action === 'proceed' ? g.location : undefined };
    } else if (name === 'consultar_precos') {
      const g = geo(args);
      if (g.action !== 'proceed') result = { ok: false, erro: g.reason || g.action, orientacao: g.text || 'Equipe confirma os valores; não invente preços.' };
      else if (args.formacao) {
        const v = quote({ ...args, formacao: args.formacao });
        result = briefQuote(v.quote);
      } else {
        const formations = ['Duo', 'Trio', 'Quarteto', 'Quinteto', 'Sexteto'];
        const rows = formations.map((f) => ({ f, q: quote({ ...args, formacao: f }).quote }));
        const valid = rows.filter(({ q }) => q && !hasRegionIssue(q) && q.sources?.ceremony === 'quote_price_rules').map(({ f, q }) => ({ formacao: f, valor_cerimonia: q.items.find((i) => i.key === 'ceremony')?.amount }));
        const texto = formatCeremonyTable(valid);
        result = texto ? { ok: true, tabela: texto, observacao: 'Tabela oficial; som não incluso. Não repita e não invente valores.' } : { ok: false, erro: 'regiao_sem_tabela', orientacao: 'A equipe confirma os valores dessa região.' };
        if (texto) effects.quoteTableText = texto;
      }
    } else if (name === 'calcular_orcamento') {
      const v = quote(args);
      result = v.quote ? briefQuote(v.quote) : { ok: false, erro: v.gate.reason || v.gate.action, orientacao: v.gate.text || 'A equipe confirma os valores.' };
    } else if (name === 'solicitar_aprovacao' || name === 'transferir_para_humano') {
      result = { ok: true, simulacao: true, orientacao: 'Seria encaminhado à equipe no atendimento real. Nenhuma pendência foi criada.' };
    } else result = { ok: false, erro: 'ferramenta_bloqueada_no_teste' };
    effects.toolResults.push({ ferramenta: name, resultado: result.ok ? 'ok' : 'pendente', detalhe: result.erro || result.status || null });
    return result;
  }

  const isFirst = !messages.some((m) => m.role === 'assistant');
  const system = buildSystemPrompt({
    settings: context.settings || {}, companyName: context.companyName, conversation: simulated,
    isFirstAiReply: isFirst,
  }) + '\n\nAMBIENTE DE TESTE ISOLADO: comporte-se como a Nara real. Use as ferramentas somente de leitura disponíveis. Não invente resultados de consultas na web ou mapas; estes serviços não estão conectados. Nunca afirme que criou contratos ou enviou mensagens reais. O histórico acima guarda a memória da conversa.';
  try {
    const result = await generateReply({
      system, input: buildConversationInput(messages.map((m, i) => ({ direction: m.role === 'user' ? 'inbound' : 'outbound', sender_type: 'ai', content: m.content, created_at: new Date(1700000000000 + i * 1000).toISOString() }))),
      tools: TOOLS, executeTool,
    });
    const fixed = effects.quoteTableText ? effects.quoteTableText : (result.text || '').trim();
    const reply = isFirst ? ensureFirstContactIntro(fixed, { settings: context.settings || {}, companyName: context.companyName }) : fixed;
    if (!reply) return NextResponse.json({ ok: false, error: 'A Nara não gerou resposta nesta tentativa.' }, { status: 503 });
    return NextResponse.json({
      ok: true, reply, lead, diagnostic: { toolCalls: result.toolCalls || [], results: effects.toolResults, model: result.model, costUsd: result.costUsd, simulated: true, mapsConnected: false },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[AI][CHAT_SIMULATION][ERROR]', { message: error?.message });
    return NextResponse.json({ ok: false, error: 'Não foi possível consultar a Nara. Confira a configuração da IA.' }, { status: 503 });
  }
}
