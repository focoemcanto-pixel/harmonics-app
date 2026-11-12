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
