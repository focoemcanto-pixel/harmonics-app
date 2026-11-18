// Run from the repository with the alias loader and an OpenAI test credential.
// This sends only invented dialogue and commercial fixtures to the model.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (!process.env.OPENAI_API_KEY?.trim()) {
  throw new Error('OPENAI_API_KEY de teste é obrigatória para a avaliação com o modelo.');
}

// Optional checkout path lets the same scenarios compare two V2 revisions.
const root = pathToFileURL(resolve(process.argv[2] || '.') + '/');
const fromRepo = (path) => import(new URL(path, root));
const [{ runNaraV2 }, { executeTool }, { buildCommercialContext, clearKnowledgeCache },
  { createSimulationStore }, { fixtures }] = await Promise.all([
  fromRepo('lib/ai/agent/v2.mjs'), fromRepo('lib/ai/agent/tools.mjs'),
  fromRepo('lib/ai/commercial/engine.mjs'), fromRepo('lib/ai/commercial/simulation-store.mjs'),
  import('./fixtures.mjs'),
]);

const workspaceId = 'synthetic-v2-evaluation';
const scope = (items) => items.map((item) => ({ workspace_id: workspaceId, ...item }));
const knowledge = scope(fixtures.knowledge.map((item) => ({ status: 'active', ...item })));
const reference = {
  ai_knowledge_items: knowledge,
  quote_price_rules: scope(fixtures.rules),
  ai_service_areas: scope(fixtures.areas),
  pricing_settings: scope([fixtures.pricing]),
  ai_venues: scope([
    { name: 'Casa Rio de Ensaio', city: 'Cidade Base', status: 'verified' },
    { name: 'Santorini de Ensaio', city: 'Cidade Metro', status: 'verified' },
  ]),
};
const MONEY = /R\$\s*\d|\d\s*reais\b/i;
const noPrice = ({ text }) => assert.doesNotMatch(text, MONEY);
const official = ({ effects }) => assert.ok(effects.quoteText || effects.quoteTableText);
const form = [
  'NOVO PEDIDO DE ORÇAMENTO — HARMONICS', 'DADOS DO EVENTO:',
  'Tipo: Casamento', 'Data: 10/10/2098', 'Cidade: Cidade Base', 'Local: Casa Rio de Ensaio',
  'FORMAÇÃO SELECIONADA:', 'Trio',
].join('\n');
const cases = [
  { name: 'formulário, horário indefinido e troca de espaço', turns: [
    [form, (turn) => { official(turn); assert.equal(turn.lead.local, 'Casa Rio de Ensaio'); }],
    ['Ainda não temos horário. A música dura quanto tempo na cerimônia?', noPrice],
    ['Corrigindo: será no Santorini de Ensaio, na Cidade Metro. Quanto fica o Trio?',
      (turn) => { official(turn); assert.equal(turn.lead.cidade, 'Cidade Metro'); }],
    ['Como escolho as músicas do cortejo?', noPrice],
    ['E posso sugerir uma música que não está no repertório?', noPrice],
  ] },
  ...[1, 2, 3].map((hours) => ({ name: `cerimônia e receptivo ${hours}h, equipe igual e equipe nova`, turns: [
    [form, official],
    ['E receptivo?', ({ effects, lead }) => { assert.ok(effects.receptionTableText); assert.equal(lead.recepcao_horas, undefined); }],
    [`Na cerimônia, Trio de piano, violino e voz. No receptivo, os mesmos três, por ${hours}h. Qual a referência?`, official],
    [`Troque só o violino por um músico novo de cajón no receptivo de ${hours}h. Qual o total?`,
      ({ text, effects }) => { assert.ok(!effects.closingSummaryText); assert.doesNotMatch(text, /Total de referência:/i); }],
    ['Quero fechar nessa combinação com músico novo. Pode reservar?', ({ text, effects }) => {
      assert.ok(!effects.closingSummaryText);
      assert.doesNotMatch(text, /reserva confirmada|data garantida/i);
    }],
  ] })),
  { name: 'objeção repetida e fechamento supervisionado', turns: [
    [form, official],
    ['Achei caro. Tem desconto?', noPrice],
    ['Ainda achei caro. Tem desconto?', noPrice],
    ['Quero fechar só o Trio da cerimônia. O horário será 16h. Quais são os próximos passos?',
      ({ effects }) => assert.ok(effects.closingSummaryText)],
    ['CONFIRMO', ({ result }) => assert.equal(result.intent, 'accept_offer')],
  ] },
];

for (const { name, turns } of cases) {
  clearKnowledgeCache();
  let conversation = { id: 'simulation', workspace_id: workspaceId, lead_data: {}, sales_stage: 'qualifying' };
  const input = [];
  for (const [index, [content, check]] of turns.entries()) {
    const local = createSimulationStore({ ...reference, ai_conversations: [conversation] });
    const effects = {};
    const options = { supabase: local, workspaceId, conversation, effects, ownerVersion: 0,
      settings: fixtures.settings, simulated: true, venueSearchFn: async () => ({ status: 'unavailable' }),
      routeFn: async () => null };
    const loadCommercial = () => buildCommercialContext({
      ...options, latestText: content, customerStatus: 'lead', referenceKnowledge: knowledge,
    });
    input.push({ role: 'user', content });
    const start = Date.now();
    // Older V2 built its commercial context outside the agent, before parsing intake.
    const commercial = process.argv[3] === 'baseline' ? await loadCommercial() : undefined;
    const result = await runNaraV2({
      ...options, companyName: fixtures.companyName, input, commercial,
      loadCommercial: commercial ? undefined : loadCommercial,
      execute: (tool, args) => executeTool(tool, args, options),
    });
    const text = result.text;
    const lead = conversation.lead_data;
    let pass = true;
    try { check({ text, effects, lead, result }); } catch { pass = false; process.exitCode = 1; }
    console.log(JSON.stringify({ name, turn: index + 1, pass, model: result.model, version: result.engineVersion,
      tools: result.toolCalls, latencyMs: Date.now() - start, inputTokens: result.inputTokens,
      outputTokens: result.outputTokens, costUsd: result.costUsd, simulated: result.simulated }));
    input.push({ role: 'assistant', content: text });
    conversation = { ...conversation, lead_data: structuredClone(lead) };
  }
}
