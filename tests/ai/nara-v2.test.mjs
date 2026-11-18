import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNaraV2Prompt, safeV2Args, v2PriceReplayBlocked, renderNaraV2Reply,
  runNaraV2, NARA_V2_VERSION, V2_ALLOWED,
} from '../../lib/ai/agent/v2.mjs';
import { simulationClosingSignature } from '../../lib/ai/commercial/closing.mjs';

const FORM = [
  'NOVO PEDIDO DE ORÇAMENTO — HARMONICS',
  'DADOS DO EVENTO:', 'Tipo: Casamento', 'Data: 14/03/2027',
  'Horário: 16:00', 'Cidade: Cidade Sintética', 'Local: Espaço Exemplo',
  'FORMAÇÃO SELECIONADA:', 'Trio'
].join('\n');

const fakeAgent = (callback) => config => ({
  generate: async () => ({
    text: await callback(config),
    totalUsage: { inputTokens: 150, outputTokens: 55 },
  }),
});
const base = () => ({
  conversation: { id: 'synthetic-nara-v2', lead_data: { cidade: 'Cidade Sintética' } },
  simulated: true,
  modelOverride: {},
  settings: { assistant_name: 'Nara' },
  companyName: 'Banda Harmonics',
  commercial: { knowledgeText: 'Regras aprovadas para consultoria musical.' },
});

test('v2 is a free conversation with commercial tools, not a compulsory plan tool', () => {
  const prompt = buildNaraV2Prompt({
    settings: { assistant_name:'Nara' },
    conversation:{lead_data:{cidade:'Cidade Sintética',tipo_evento:'Casamento'}},
    commercial:{knowledgeText:'Regras aprovadas de cerimônia'},
  });
  assert.match(prompt, /AGENTE LIVRE/);
  assert.match(prompt, /sem chamar ferramenta/);
  assert.match(prompt, /memória|conversa/i);
  assert.doesNotMatch(prompt, /use conduzir_atendimento/i);
  assert.ok(!V2_ALLOWED.includes('consultar_meu_cadastro'));
  assert.ok(!V2_ALLOWED.includes('obter_link_cliente'));
  assert.ok(!V2_ALLOWED.includes('vincular_evento'));
});

test('only simulated admin flow may invoke the Vercel AI SDK engine', async () => {
  await assert.rejects(runNaraV2({
    ...base(), simulated: false, execute: async () => ({ ok:true }),
  }), /nara_v2_simulator_only/);
});

test('reception without a choice cannot fabricate Duo or a duration', () => {
  assert.deepEqual(safeV2Args('registrar_dados_evento',
    { formacao:'Duo',recepcao_formacao:'Duo',recepcao_horas:'1',som:'sim' },
    {},'E receptivo!'),{});
  assert.deepEqual(safeV2Args('consultar_precos',{formacao:'Duo'}, {}, 'E receptivo!'),{});
  assert.equal(safeV2Args('calcular_orcamento',{formacao:'Duo'}, {},'E receptivo!'),null);
  assert.equal(safeV2Args('registrar_dados_evento',{formacao:'Trio'},{},'Gostei do Trio').formacao,'Trio');
});

test('a question about duration after the quote does not reopen the price table', () => {
  assert.equal(v2PriceReplayBlocked({
    latestText:'Como funciona? Quanto tempo vocês tocam?',
    input:[{role:'assistant',content:'🎶 Orçamentos Cerimônia 🎶\nTrio R$ 1.750'}],
  }),true);
  assert.equal(v2PriceReplayBlocked({
    latestText:'E receptivo!',
    input:[{role:'assistant',content:'🎶 Orçamentos Cerimônia 🎶\nTrio R$ 1.750'}],
  }),false);
  assert.equal(v2PriceReplayBlocked({ latestText:'Trio',
    lead:{ ultimo_orcamento:'Tabela enviada' } }),false, 'short formation selection is a fresh quote');
  assert.equal(v2PriceReplayBlocked({ latestText:'Trio',
    lead:{ ultimo_orcamento:'Tabela enviada',formacao:'Trio' } }),true, 'identical choice should not resend the quote');
});

test('reception question inserts the official matrix, no ceremony repetition or invented selection', async () => {
  const ctx=base(),effects={},calls=[];
  const answer=await runNaraV2({
    ...ctx, effects,
    input:[{role:'assistant',content:'🎶 Orçamentos Cerimônia 🎶\nDuo ...'},
      {role:'user',content:'E receptivo!'}],
    execute:async(name,args)=>{
      calls.push({name,args});
      if(name==='consultar_tabela_receptivo'){
        effects.receptionTableText='🎶 Receptivo — Duo 1h R$ 500 · Trio 1h R$ 800';
        return {ok:true,tabela_pronta:true};
      }
      return {ok:false};
    },
    agentFactory:fakeAgent(async cfg=>{
      const response=await cfg.tools.consultar_precos.execute({formacao:'Duo'});
      assert.equal(response.status,'official_price_already_present');
      return 'Claro! A formação do receptivo pode ser diferente da cerimônia.';
    }),
  });
  assert.equal(calls.length,1);
  assert.equal(calls[0].name,'consultar_tabela_receptivo');
  assert.equal(ctx.conversation.lead_data.formacao,undefined);
  assert.match(answer.text,/Receptivo — Duo 1h R\$ 500/);
  assert.doesNotMatch(answer.text,/Orçamentos Cerimônia/);
  assert.deepEqual(answer.toolCalls,['consultar_tabela_receptivo']);
  assert.equal(answer.engineVersion,NARA_V2_VERSION);
});

test('ordinary dialogue can answer freely without tool calls or compulsory categories', async () => {
  const ctx=base(),calls=[];
  const answer=await runNaraV2({
    ...ctx,
    input:[{role:'user',content:'Como funciona a cerimônia?'}],
    execute:async(name)=>{calls.push(name);return {ok:false};},
    agentFactory:fakeAgent(async cfg=>{
      assert.equal(typeof cfg.tools.calcular_orcamento.execute,'function');
      assert.equal(cfg.model != null,true);
      return 'A música acompanha as entradas e os momentos do casamento; a duração depende do roteiro.';
    }),
  });
  assert.deepEqual(calls,[]);
  assert.match(answer.text,/duração depende do roteiro/);
});

test('all prices are rendered only from existing approved domain tools', () => {
  assert.doesNotMatch(renderNaraV2Reply({modelText:'O Trio custa R$ 999 sem consultar a tabela.'}),/R\$ 999/);
  assert.equal(renderNaraV2Reply({
    modelText:'Trio R$ 999 inventado',
    effects:{quoteTableText:'🎶 Orçamentos Cerimônia\nTrio R$ 1.750'},
  }).split('Trio R$ 1.750').length,2);
});

test('complete site forms are remembered before the model replies, no extra model pass', async () => {
  const ctx=base();let leadAtGeneration;
  const answer=await runNaraV2({
    ...ctx, input:[{role:'user',content:FORM}], execute:async()=>({ok:true}),
    agentFactory:fakeAgent(async()=>{leadAtGeneration={...ctx.conversation.lead_data};return 'Perfeito, recebi seu pedido.';}),
  });
  assert.equal(leadAtGeneration.formacao,'Trio');
  assert.equal(leadAtGeneration.data_evento,'2027-03-14');
  assert.match(answer.text,/recebi seu pedido/);
});

test('new city recorded by the model permits fresh official quote without repeating old prices', async () => {
  const ctx = base(), effects = {}, called = [];
  ctx.conversation.lead_data.ultimo_orcamento = 'Tabela anterior';
  const result = await runNaraV2({
    ...ctx, effects,
    input:[
      {role:'assistant',content:'🎶 Orçamentos Cerimônia 🎶\nDuo ...'},
      {role:'user',content:'Agora o casamento será na Cidade Nova.'},
    ],
    execute:async(name,args)=>{
      called.push(name);
      if(name==='registrar_dados_evento'){
        Object.assign(ctx.conversation.lead_data, args);
        return {ok:true,salvo:true};
      }
      if(name==='consultar_precos'){
        effects.quoteTableText = '🎶 Orçamento atualizado: Trio R$ 1.850';
        return {ok:true};
      }
      return {ok:false};
    },
    agentFactory:fakeAgent(async cfg=>{
      await cfg.tools.registrar_dados_evento.execute({cidade:'Cidade Nova', tipo_evento:'Casamento'});
      const quote = await cfg.tools.consultar_precos.execute({});
      assert.equal(quote.ok,true);
      return 'Com a cidade corrigida, veja a cotação oficial da região.';
    }),
  });
  assert.equal(ctx.conversation.lead_data.cidade,'Cidade Nova');
  assert.deepEqual(called,['registrar_dados_evento','consultar_precos']);
  assert.match(result.text,/Orçamento atualizado: Trio R\$ 1.850/);
});

test('final simulated confirmation advances without model call or real contract', async () => {
  const lead={cidade:'Cidade Sintética',data_evento:'2027-03-14',horario:'16:00',
    formacao:'Trio',local:'Espaço Exemplo'};
  const summary='Simulação de fechamento — confira o resumo.';
  const ctx={...base(),conversation:{
    lead_data:lead, simulation_closing:{
      status:'awaiting_confirmation',
      signature:simulationClosingSignature(lead),
      lastReply:summary,
    },
  }};
  let agentInvocations=0;
  const factory=fakeAgent(async()=>{agentInvocations++;return 'Não deveria executar';});
  const first=await runNaraV2({...ctx,
    input:[{role:'assistant',content:summary},{role:'user',content:'Exatamente'}],
    execute:async()=>{throw Error('No actions allowed');},agentFactory:factory,
  });
  assert.match(first.text,/Dados confirmados/);
  const next=await runNaraV2({...ctx,
    input:[{role:'assistant',content:first.text},{role:'user',content:'Pode fazer contrato'}],
    execute:async()=>{throw Error('No actions allowed');},agentFactory:factory,
  });
  assert.match(next.text,/pré-contrato simulada/);
  assert.equal(agentInvocations,0);
  assert.equal(ctx.conversation.simulation_closing.status,'precontract_preview');
});

test('V2 carries the form and corrected location across turns and scopes approved retrieval on the first turn', async () => {
  const { buildCommercialContext } = await import('../../lib/ai/commercial/engine.mjs');
  const { createSimulationStore } = await import('../../lib/ai/commercial/simulation-store.mjs');
  const ctx = base();
  ctx.conversation.workspace_id = 'synthetic-workspace';
  const item = { kind: 'faq', title: 'Repertório de casamento', intents: ['repertoire'],
    metadata: { scope: { event_types: ['Casamento'] } }, priority: 65 };
  const knowledge = [
    { ...item, id: 'music', status: 'active', content: 'A equipe avalia os pedidos musicais do casal.' },
    { ...item, id: 'pending', status: 'pending_approval', content: 'Referência musical pendente.' },
    { ...item, id: 'oversize', status: 'active', priority: 99, content: 'Repertório '.repeat(240) },
  ];
  const customers = [
    FORM + '\nPodemos escolher as músicas do cortejo? Quero orçamento.',
    'Corrigindo: o local é Salão Fictício, na Cidade de Ensaio.',
    'Ainda não temos horário. O orçamento segue?',
    'Achei caro, tem desconto?',
    'Ainda quero saber se tem desconto.',
    'E sobre o repertório, podemos sugerir músicas?',
  ];
  const input = [];
  for (const [turn, content] of customers.entries()) {
    input.push({ role: 'user', content });
    const local = createSimulationStore({ ai_conversations: [ctx.conversation] });
    const result = await runNaraV2({
      ...ctx, input,
      loadCommercial: () => buildCommercialContext({
        supabase: local, workspaceId: ctx.conversation.workspace_id,
        conversation: ctx.conversation, latestText: content, customerStatus: 'lead',
        referenceKnowledge: knowledge,
      }),
      execute: async (name, args) => {
        assert.equal(name, 'registrar_dados_evento');
        const { rememberInSession } = await import('../../lib/ai/agent/conversation-turn.mjs');
        rememberInSession(ctx.conversation, args);
        return { ok: true };
      },
      agentFactory: fakeAgent(async ({ instructions, tools }) => {
        if (turn === 0 || turn === 5) {
          assert.match(instructions, /equipe avalia os pedidos musicais/);
          assert.doesNotMatch(instructions, /Referência musical pendente|(?:Repertório ){40}/);
        }
        if (turn === 1) await tools.registrar_dados_evento.execute({ local: 'Salão Fictício', cidade: 'Cidade de Ensaio', horario: 'remover' });
        if (turn >= 2) {
          assert.match(instructions, /Salão Fictício/);
          assert.doesNotMatch(instructions, /Local: Espaço Exemplo|Horário: 16:00/);
        }
        if (turn === 3) assert.doesNotMatch(instructions, /repetiu uma objeção/);
        if (turn === 4) assert.match(instructions, /repetiu uma objeção/);
        return 'Vou considerar as suas escolhas.';
      }),
    });
    input.push({ role: 'assistant', content: result.text });
  }
  assert.equal(ctx.conversation.lead_data.formacao, 'Trio');
  assert.equal(ctx.conversation.lead_data.cidade, 'Cidade de Ensaio');
  assert.equal(ctx.conversation.lead_data.horario, undefined);
});

test('V2 defers changed reception personnel and keeps the official path for the same lineup', async () => {
  for (const hours of [1, 2, 3]) {
    const ctx = base();
    ctx.conversation.lead_data = { tipo_evento: 'Casamento', formacao: 'Trio', instrumentos: 'Piano, violino e voz',
      recepcao_formacao: 'Trio', recepcao_horas: String(hours) };
    const calls = [];
    const result = await runNaraV2({
      ...ctx, input: [{ role: 'user', content: 'Quero fechar com essa formação para o receptivo.' }],
      execute: async (name) => { calls.push(name); return { ok: true }; },
      agentFactory: fakeAgent(async ({ tools }) => {
        const changed = { formacao: 'Trio', recepcao_horas: hours, recepcao_instrumentos: 'Voz, piano e cajón' };
        for (const name of ['calcular_orcamento', 'comparar_receptivo', 'consultar_precos', 'preparar_fechamento']) {
          assert.equal((await tools[name].execute(changed)).status, 'reception_personnel_review_required');
        }
        await tools.calcular_orcamento.execute({ formacao: 'Trio', recepcao_instrumentos: 'Voz, violino e piano' });
        return 'A equipe confirma a composição solicitada.';
      }),
    });
    assert.deepEqual(calls, ['calcular_orcamento']);
    assert.equal(result.diagnostics.filter((entry) => entry.resultado === 'revisao_equipe_receptivo').length, 4);
  }
});

test('V2 simulated sales journey gates the quote and carries the selected Trio into explicit acceptance', async () => {
  const [{ fixtures }, { buildCommercialContext }, { createSimulationStore }, { executeTool }] = await Promise.all([
    import('../../evals/nara/fixtures.mjs'), import('../../lib/ai/commercial/engine.mjs'),
    import('../../lib/ai/commercial/simulation-store.mjs'), import('../../lib/ai/agent/tools.mjs'),
  ]);
  const workspaceId = 'synthetic-journey';
  let conversation = { id: 'simulation', workspace_id: workspaceId, lead_data: {}, sales_stage: 'qualifying' };
  const input = [];
  const scope = (rows) => rows.map((item) => ({ workspace_id: workspaceId, ...item }));
  const activePayment = { id: 'policy-example', kind: 'policy', status: 'active', title: 'Pagamento',
    content: 'Pix em duas etapas, sete dias e um dia antes do evento.', intents: ['payment'], priority: 100 };
  const knowledge = scope([...fixtures.knowledge.map((item) => ({ status: 'active', ...item })), activePayment]);

  async function turn(content, callback) {
    const effects = {};
    const supabase = createSimulationStore({
      ai_conversations: [conversation], ai_service_areas: scope(fixtures.areas),
      pricing_settings: scope([fixtures.pricing]), quote_price_rules: scope(fixtures.rules),
    });
    const ctx = { conversation, workspaceId, supabase, effects, settings: fixtures.settings,
      simulated: true, ownerVersion: 0, routeFn: async () => null };
    input.push({ role: 'user', content });
    const result = await runNaraV2({ ...ctx, input, modelOverride: {},
      loadCommercial: () => buildCommercialContext({ ...ctx, latestText: content,
        referenceKnowledge: knowledge, customerStatus: 'lead' }),
      execute: (name, args) => executeTool(name, args, ctx),
      agentFactory: fakeAgent(callback ?? (() => assert.fail('Model must not run on this turn'))),
    });
    assert.ok(!supabase.writes.some((write) =>
      ['quotes', 'contracts', 'precontracts', 'ai_message_outbox'].includes(write.table)));
    input.push({ role: 'assistant', content: result.text });
    conversation = JSON.parse(JSON.stringify(conversation));
    return { result, effects };
  }

  await turn('Olá, gostaria de um orçamento', () => 'Qual é a data, o local e o tipo de evento?');
  await turn('17/12/2096, na Casa Rio de Ensaio, 16:30', async ({ tools }) => {
    await tools.registrar_dados_evento.execute({ data_evento: '17/12/2096',
      local: 'Casa Rio de Ensaio', horario: '16:30', tipo_evento: 'Casamento' });
    return 'Em qual cidade fica esse espaço?';
  });
  await turn('Na Cidade Base mesmo', async ({ tools }) => {
    await tools.registrar_dados_evento.execute({ cidade: 'Cidade Base' });
    assert.equal((await tools.consultar_precos.execute({})).status, 'event_type_required');
    return 'Qual é o tipo de evento?';
  });
  const quote = await turn('É para a cerimônia do casamento.', ({ instructions }) => {
    assert.match(instructions, /Evento: Casamento/);
    return 'Ainda falta conferir os valores.';
  });
  assert.ok(quote.effects.quoteTableText);
  await turn('Como funciona o pagamento?', ({ instructions }) => {
    assert.match(instructions, /Condições de pagamento ativas para esta dúvida:\n.*sete dias/s);
    assert.doesNotMatch(instructions, /Sinal de 30%/);
    return 'O pagamento é via Pix em duas etapas, sete dias e um dia antes do evento.';
  });
  await turn('u');
  await turn('Pretendo fechar com vocês, como fazemos?', async ({ tools }) => {
    assert.equal((await tools.preparar_fechamento.execute({ formacao: 'Duo' })).status, 'closing_details_required');
    return 'Qual das formações você quer para a cerimônia?';
  });
  const closing = await turn('Trio', ({ instructions }) => {
    assert.match(instructions, /Formação: Trio/);
    return 'Preferem piano ou violão?';
  });
  assert.match(closing.result.text, /Casa Rio de Ensaio/);
  assert.match(closing.result.text, /Cerimônia: Trio/);
  assert.match(closing.result.text, /Sonorização: não incluída/);
  const final = await turn('confirmo');
  assert.equal(final.result.intent, 'accept_offer');
  assert.equal(conversation.simulation_closing.status, 'confirmed');
  assert.deepEqual(final.result.toolCalls, []);
  assert.doesNotMatch(final.result.text, /em breve|entraremos em contato|https?:/i);
});


test('V2 rejects a confirmation referring to a summary with superseded event details', async () => {
  const lead = { tipo_evento: 'Casamento', local: 'Salão de Ensaio', formacao: 'Trio' };
  const previousReply = 'Confira o resumo do Trio.';
  const conversation = { lead_data: { ...lead, formacao: 'Duo' }, simulation_closing: {
    status: 'awaiting_confirmation', signature: simulationClosingSignature(lead), lastReply: previousReply,
  } };
  const result = await runNaraV2({ ...base(), conversation,
    input: [{ role: 'assistant', content: previousReply }, { role: 'user', content: 'confirmo' }],
    execute: () => assert.fail('No action on stale confirmation'),
    agentFactory: () => assert.fail('No model on stale confirmation'),
  });
  assert.equal(conversation.simulation_closing, null);
  assert.notEqual(result.intent, 'accept_offer');
  assert.match(result.text, /resumo atualizado/i);
});
