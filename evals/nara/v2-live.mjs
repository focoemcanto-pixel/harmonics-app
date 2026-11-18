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
const policy = { id: 'synthetic-payment', workspace_id: workspaceId, kind: 'policy',
  title: 'Pagamento', intents: ['payment'], priority: 100, status: 'active',
  content: 'Pagamento por Pix em duas etapas iguais, sete dias antes e um dia antes do evento. Cartão não disponível.' };
const noExternalPromise = ({ text, local }) => {
  assert.doesNotMatch(text, /em breve entraremos em contato|data garantida|reserva confirmada|https?:|(?:vou|vamos) (?:enviar|mandar|reservar)/i);
  assert.ok(!local.writes.some(({ table }) => ['quotes', 'precontracts', 'contracts', 'ai_message_outbox'].includes(table)));
};
const cases = [
  { name: 'recomendação de formação, som do espaço e tempo para decidir', turns: [
    [form, official],
    ['Gostei do Duo e do Trio. Quero algo delicado e faço questão de ouvir violino no cortejo. Qual escolher?', (turn) => {
      noPrice(turn);
      assert.match(turn.text, /trio/i);
      assert.match(turn.text, /violino/i);
      assert.doesNotMatch(turn.text, /(?:qual|que) (?:é )?(?:a data|o local|a cidade)/i);
    }],
    ['O espaço já tem som. Preciso contratar o som de vocês?', (turn) => {
      noPrice(turn);
      assert.match(turn.text, /espaço|estrutura|equipamento/i);
      noExternalPromise(turn);
    }],
    ['Quero só essas informações por enquanto. Vou conversar com meu parceiro.', (turn) => {
      noPrice(turn);
      assert.doesNotMatch(turn.text, /\?|podemos fechar|vamos reservar/i);
      noExternalPromise(turn);
    }],
  ] },
  ...[false, true].map((activePayment) => ({
    name: `orçamento até aceite, política ${activePayment ? 'ativa' : 'pendente'}`,
    activePayment,
    turns: [
      ['Olá, gostaria de um orçamento', noPrice],
      ['17/12/2096, na Casa Rio de Ensaio, 16:30', noPrice],
      ['Na Cidade Base mesmo', ({ lead, ...turn }) => {
        noPrice(turn);
        assert.equal(lead.tipo_evento, undefined);
      }],
      ['É para a cerimônia do meu casamento.', official],
      ['Perfeito! Como funciona a forma de pagamento?', ({ text, ...turn }) => {
        noPrice({ text });
        assert.doesNotMatch(text, /30%|três parcelas|3 parcelas|14 dias|48 horas/i);
        assert.doesNotMatch(text, /\?\s*$/);
        if (activePayment) {
          assert.match(text, /pix/i);
          assert.match(text, /(?:sete|7) dias/i);
          assert.match(text, /(?:um|1) dia/i);
        } else assert.doesNotMatch(text, /pix|cartão|\d+%/i);
        noExternalPromise({ text, ...turn });
      }],
      ['u', ({ lead, text, effects }) => {
        assert.equal(lead.formacao, undefined);
        assert.ok(!effects.closingSummaryText);
        assert.match(text, /incompleta|restante/i);
      }],
      ['Pretendo fechar com vocês, como fazemos?', ({ text, effects }) => {
        assert.ok(!effects.closingSummaryText);
        assert.match(text, /formaç|duo|trio/i);
        assert.doesNotMatch(text, /qual.*(?:data|cidade|horário)/i);
      }],
      ['Trio', ({ lead, effects }) => {
        assert.equal(lead.formacao, 'Trio');
        assert.ok(effects.closingSummaryText);
        assert.match(effects.closingSummaryText, /Casa Rio de Ensaio/);
      }],
      ['confirmo', (turn) => {
        assert.equal(turn.result.intent, 'accept_offer');
        assert.equal(turn.conversation.simulation_closing?.status, 'confirmed');
        noExternalPromise(turn);
      }],
    ],
  })),
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

for (const { name, turns, activePayment } of cases) {
  clearKnowledgeCache();
  let conversation = { id: 'simulation', workspace_id: workspaceId, lead_data: {}, sales_stage: 'qualifying' };
  const input = [];
  for (const [index, [content, check]] of turns.entries()) {
    const scenarioKnowledge = activePayment ? [...knowledge, policy] : knowledge;
    const local = createSimulationStore({ ...reference, ai_knowledge_items: scenarioKnowledge,
      ai_conversations: [conversation] });
    const effects = {};
    const options = { supabase: local, workspaceId, conversation, effects, ownerVersion: 0,
      settings: fixtures.settings, simulated: true, venueSearchFn: async () => ({ status: 'unavailable' }),
      routeFn: async () => null };
    const loadCommercial = () => buildCommercialContext({
      ...options, latestText: content, customerStatus: 'lead', referenceKnowledge: scenarioKnowledge,
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
    let failure = null;
    try { check({ text, effects, lead, result, local, conversation }); }
    catch (error) { failure = error.message; process.exitCode = 1; }
    console.log(JSON.stringify({ name, turn: index + 1, pass: !failure, failure, rubric: /recomendação|política|objeção/.test(name) ? 'condução e segurança' : 'continuidade e segurança',
      ...(process.env.NARA_EVAL_TRANSCRIPT === '1' ? { customer: content, reply: text } : {}),
      model: result.model, version: result.engineVersion,
      tools: result.toolCalls, latencyMs: Date.now() - start, inputTokens: result.inputTokens,
      outputTokens: result.outputTokens, costUsd: result.costUsd, simulated: result.simulated }));
    input.push({ role: 'assistant', content: text });
    conversation = { ...conversation, lead_data: structuredClone(lead) };
  }
}
