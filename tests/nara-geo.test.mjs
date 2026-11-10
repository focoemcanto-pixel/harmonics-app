// Inteligência geográfica da Nara — dados 100% sintéticos (localidades e espaços inventados).
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLocation, locationGate, otherStateIn, composeLocation, askCityMessage, customQuoteMessage, knownTravelMinutes } from '../lib/ai/commercial/geo.mjs';
import { calculateQuote, hasRegionIssue, isCustomQuote } from '../lib/ai/commercial/pricing.mjs';

const AREAS = [
  { id: 'a1', name: 'Cidade Base Teste', status: 'served', price_tier: 'base', active: true },
  { id: 'a2', name: 'Vila Vizinha Teste', status: 'served', price_tier: 'base', active: true },
  { id: 'a3', name: 'Cidade Distante Teste', status: 'served', price_tier: 'faixa-x', travel_fee: 111, travel_minutes: 170, active: true },
  { id: 'a4', name: 'Cidade Faixa Longa Teste', status: 'served', price_tier: 'faixa-x', travel_fee: 111, travel_minutes: 140, active: true },
];
const RULES = [
  { category: 'ceremony', item_key: 'trio', amount: 1234, valid_from: '2026-01-01' },
  { category: 'ceremony', item_key: 'trio@faixa-x', amount: 2345, valid_from: '2026-01-01' },
];
const D = '2027-03-14';

test('só o nome do espaço => perguntar a cidade (nunca presumir a região-base)', () => {
  const r = analyzeLocation({ local: 'Chácara Recanto Inventado', areas: AREAS });
  assert.equal(r.kind, 'venue_only');
  assert.match(askCityMessage(r.venue), /Em qual cidade fica/);
  assert.doesNotMatch(askCityMessage(r.venue), /Salvador/);
});

test('espaço + cidade em mensagens separadas são combinados', () => {
  assert.equal(composeLocation('Chácara Recanto Inventado', 'Vila Vizinha Teste'), 'Chácara Recanto Inventado, Vila Vizinha Teste');
  const r = analyzeLocation({ local: 'Chácara Recanto Inventado', cidade: 'Vila Vizinha Teste', areas: AREAS });
  assert.equal(r.kind, 'area');
  assert.equal(r.area.id, 'a2');
});

test('nome de espaço sem verificação não vira endereço apenas por informar a cidade', () => {
  const initial = locationGate({ local: 'Chácara Recanto Inventado', areas: AREAS });
  assert.equal(initial.action, 'ask');
  assert.equal(initial.reason, 'cidade_necessaria');
  const next = locationGate({ local: 'Chácara Recanto Inventado', cidade: 'Vila Vizinha Teste', areas: AREAS });
  assert.equal(next.action, 'ask');
  assert.equal(next.reason, 'espaco_nao_verificado');
  assert.match(next.text, /endereço ou a localização/);
  const specific = locationGate({ local: 'Chácara Recanto Inventado, Rua das Flores 10, Vila Vizinha Teste', areas: AREAS });
  assert.equal(specific.action, 'proceed');
});

test('cidade sem cadastro não recebe faixa automática', () => {
  assert.equal(analyzeLocation({ local: 'Cidade Sem Cadastro', areas: AREAS }).kind, 'unregistered');
  const q = calculateQuote({ date: D, formation: 'Trio', location: 'Cidade Sem Cadastro' }, { rules: RULES, areas: AREAS });
  assert.ok(q.approvals.includes('region_not_parameterized'));
  assert.ok(!q.items.some((i) => i.key === 'ceremony'));
});

test('outro estado => orçamento personalizado com aprovação, sem valores', () => {
  assert.equal(otherStateIn('Espaço Inventado, Recife - PE'), 'PE');
  assert.equal(otherStateIn('Fazenda Inventada em Sergipe'), 'sergipe');
  assert.equal(otherStateIn('Igreja do Espírito Santo'), null);
  assert.equal(otherStateIn('Hotel Campo Grande'), null);
  assert.equal(otherStateIn('Espaço Inventado - BA'), null);
  assert.equal(analyzeLocation({ local: 'Sítio Inventado, Aracaju', areas: AREAS }).kind, 'other_state');
  const q = calculateQuote({ date: D, formation: 'Trio', location: 'Sítio Inventado, Aracaju' }, { rules: RULES, areas: AREAS });
  assert.ok(q.approvals.includes('other_state_custom'));
  assert.ok(isCustomQuote(q));
  assert.ok(hasRegionIssue(q, { tableMode: true }));
  assert.ok(!q.items.some((i) => i.key === 'ceremony'));
  assert.match(customQuoteMessage('Aracaju', { otherState: true }), /personalizado/);
});

test('viagem real acima de 2h30 => personalizado; até 2h30 segue a faixa aprovada da localidade', () => {
  const longQ = calculateQuote({ date: D, formation: 'Trio', location: 'Cidade Distante Teste' }, { rules: RULES, areas: AREAS });
  assert.ok(longQ.approvals.includes('long_trip_custom'));
  assert.ok(!longQ.items.some((i) => i.key === 'ceremony'));
  const okQ = calculateQuote({ date: D, formation: 'Trio', location: 'Cidade Faixa Longa Teste' }, { rules: RULES, areas: AREAS });
  assert.ok(!isCustomQuote(okQ));
  assert.equal(okQ.items.find((i) => i.key === 'ceremony')?.amount, 2345);
});

test('rota real (quando habilitada) prevalece sobre o tempo cadastrado; limite configurável', () => {
  assert.equal(knownTravelMinutes({ area: { travel_minutes: 100 }, routing: { travelMinutes: 160 } }), 160);
  assert.equal(knownTravelMinutes({ area: {}, routing: null }), null);
  const q = calculateQuote({ date: D, formation: 'Trio', location: 'Cidade Faixa Longa Teste' }, { rules: RULES, areas: AREAS, logisticsRules: { custom_over_minutes: 120 } });
  assert.ok(q.approvals.includes('long_trip_custom'));
});

test('texto com duas localidades => ambíguo (pedir endereço/localização)', () => {
  const r = analyzeLocation({ local: 'Cidade Base Teste ou Vila Vizinha Teste', areas: AREAS });
  assert.equal(r.kind, 'ambiguous');
});

test('região-base cadastrada continua com a tabela oficial', () => {
  const q = calculateQuote({ date: D, formation: 'Trio', location: 'Espaço Inventado, Cidade Base Teste' }, { rules: RULES, areas: AREAS });
  assert.equal(q.items.find((i) => i.key === 'ceremony')?.amount, 1234);
  assert.ok(!hasRegionIssue(q));
});

function fakeDb(tables) {
  const inserts = [];
  const from = (table) => {
    const filters = [];
    const q = {
      select() { return q; }, eq(c, v) { filters.push([c, v]); return q; }, in() { return q; }, order() { return q; }, limit() { return q; },
      insert(row) { inserts.push([table, row]); return Promise.resolve({ error: null }); },
      update() { return q; }, async maybeSingle() { return { data: null, error: null }; },
      then(resolve) { resolve({ data: (tables[table] || []).filter((r) => filters.every(([c, v]) => r[c] === v)), error: null }); },
    };
    return q;
  };
  return { supabase: { from }, inserts };
}

const TOOL_TABLES = () => ({
  quote_price_rules: [
    { workspace_id: 'w', category: 'ceremony', item_key: 'duo', amount: 1000, valid_from: '2090-01-01' },
    { workspace_id: 'w', category: 'ceremony', item_key: 'trio', amount: 1500, valid_from: '2090-01-01' },
    { workspace_id: 'w', category: 'ceremony', item_key: 'duo@faixa-x', amount: 1300, valid_from: '2090-01-01' },
  ],
  ai_service_areas: [
    { workspace_id: 'w', name: 'Cidade Base Teste', status: 'served', active: true },
    { workspace_id: 'w', name: 'Cidade Distante Teste', status: 'served', active: true, price_tier: 'faixa-x', travel_fee: 111, travel_minutes: 175 },
  ],
  ai_approvals: [],
});
const toolCtx = (supabase, lead) => ({ supabase, workspaceId: 'w', conversation: { id: 'c1', lead_data: { data_evento: '2090-05-05', ...lead } }, effects: {} });

test('consultar_precos: só o espaço => pergunta fixa da cidade, sem valores e sem pendência', async () => {
  const { executeTool } = await import('../lib/ai/agent/tools.mjs');
  const { supabase, inserts } = fakeDb(TOOL_TABLES());
  const c = toolCtx(supabase, { local: 'Chácara Recanto Inventado' });
  const r = await executeTool('consultar_precos', {}, c);
  assert.equal(r.erro, 'cidade_necessaria');
  assert.equal(c.effects.quoteTableText, undefined);
  assert.equal(c.effects.regionPendingText, 'Que lindo! ☺️ Em qual cidade fica a Chácara Recanto Inventado?');
  assert.equal(inserts.filter(([t]) => t === 'ai_approvals').length, 0);
});

test('consultar_precos: espaço não verificado + cidade => pede endereço, sem inventar localização', async () => {
  const { executeTool } = await import('../lib/ai/agent/tools.mjs');
  const { supabase } = fakeDb(TOOL_TABLES());
  const c = toolCtx(supabase, { local: 'Chácara Recanto Inventado', cidade: 'Cidade Base Teste' });
  const r = await executeTool('consultar_precos', {}, c);
  assert.equal(r.erro, 'espaco_nao_verificado');
  assert.equal(c.effects.quoteTableText, undefined);
  assert.match(c.effects.regionPendingText, /localização dele|localização certinha/);
});

test('consultar_precos: outro estado => personalizado + pendência para o Owner, sem valores', async () => {
  const { executeTool } = await import('../lib/ai/agent/tools.mjs');
  const { supabase, inserts } = fakeDb(TOOL_TABLES());
  const c = toolCtx(supabase, { local: 'Sítio Inventado, Maceió - AL' });
  const r = await executeTool('consultar_precos', {}, c);
  assert.equal(r.erro, 'orcamento_personalizado');
  assert.equal(c.effects.quoteTableText, undefined);
  assert.match(c.effects.regionPendingText, /Harmonics é de Salvador.*orçamento personalizado/s);
  assert.doesNotMatch(c.effects.regionPendingText, /R\$|km|hora/);
  const ap = inserts.find(([t]) => t === 'ai_approvals')?.[1];
  assert.equal(ap?.details?.reason, 'other_state_custom');
});

test('consultar_precos e calcular_orcamento: viagem acima de 2h30 => personalizado, sem expor tempo/distância', async () => {
  const { executeTool } = await import('../lib/ai/agent/tools.mjs');
  const { supabase, inserts } = fakeDb(TOOL_TABLES());
  const c = toolCtx(supabase, { local: 'Cidade Distante Teste' });
  const r = await executeTool('consultar_precos', {}, c);
  assert.equal(r.erro, 'orcamento_personalizado');
  assert.match(c.effects.regionPendingText, /orçamento personalizado/);
  assert.doesNotMatch(c.effects.regionPendingText, /175|min|km/);
  assert.ok(inserts.some(([t, row]) => t === 'ai_approvals' && /long_trip_custom/.test(row.details?.reason)));
  const c2 = toolCtx(supabase, { local: 'Cidade Distante Teste' });
  const r2 = await executeTool('calcular_orcamento', { data: '2090-05-05', formacao: 'Duo', local: 'Cidade Distante Teste' }, { ...c2, settings: {} });
  assert.equal(r2.motivo, 'orcamento_personalizado');
  assert.equal(c2.effects.lastQuote, undefined);
});

test('calcular_orcamento: só o espaço => pergunta a cidade, sem cálculo', async () => {
  const { executeTool } = await import('../lib/ai/agent/tools.mjs');
  const { supabase, inserts } = fakeDb(TOOL_TABLES());
  const c = { ...toolCtx(supabase, {}), settings: {} };
  const r = await executeTool('calcular_orcamento', { data: '2090-05-05', formacao: 'Trio', local: 'Espaço Inventado' }, c);
  assert.equal(r.motivo, 'cidade_necessaria');
  assert.equal(c.effects.regionPendingText, 'Que lindo! ☺️ Em qual cidade fica o Espaço Inventado?');
  assert.equal(inserts.filter(([t]) => t === 'ai_approvals').length, 0);
});

test('verificar_localidade: sinaliza cidade desconhecida/outro estado sem presumir', async () => {
  const { executeTool } = await import('../lib/ai/agent/tools.mjs');
  const { supabase } = fakeDb(TOOL_TABLES());
  assert.equal((await executeTool('verificar_localidade', { local: 'Chácara Recanto Inventado' }, toolCtx(supabase, {}))).status, 'cidade_desconhecida');
  assert.equal((await executeTool('verificar_localidade', { local: 'Espaço Inventado, Recife' }, toolCtx(supabase, {}))).status, 'outro_estado');
  assert.equal((await executeTool('verificar_localidade', { local: 'Cidade Base Teste' }, toolCtx(supabase, {}))).status, 'atendido');
});
