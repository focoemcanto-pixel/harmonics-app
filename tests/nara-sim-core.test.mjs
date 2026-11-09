// Núcleo da simulação isolada: banco em memória, travas determinísticas e nenhuma rede/DB real (dados sintéticos).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSimInput, runSimTurn } from '../lib/ai/sim/nara-sim.mjs';

const FIX = {
  settings: { assistant_name: 'Lia', assistant_company: 'Conjunto Exemplo', handoff_contact_name: 'Responsável Teste' },
  companyName: 'Conjunto Exemplo',
  rules: [
    { category: 'ceremony', item_key: 'trio', amount: 1110, valid_from: '2080-01-01', valid_until: null },
    { category: 'sound', item_key: 'church', amount: 610, valid_from: '2080-01-01', valid_until: null },
    { category: 'musician_fee', item_key: 'sound_tech', amount: 110, valid_from: '2080-01-01', valid_until: null },
  ],
  areas: [{ name: 'Cidade Base', status: 'served' }],
};
const input = (messages, state = {}) => parseSimInput({ messages, state, fixtures: FIX }).input;
const fake = (fn) => async (args) => ({ model: 'roteiro', inputTokens: 1, outputTokens: 1, costUsd: 0, toolCalls: [], ...(await fn(args)) });

test('entrada: última mensagem do cliente e limites', () => {
  assert.equal(parseSimInput({ messages: [{ role: 'assistant', text: 'oi' }] }).ok, false);
  assert.equal(parseSimInput({ messages: Array.from({ length: 40 }, () => ({ role: 'customer', text: 'x' })) }).ok, false);
  assert.equal(parseSimInput({ messages: [{ role: 'customer', text: 'a'.repeat(5000) }] }).input.messages[0].text.length, 600);
});

test('1º contato: prompt com identidade e apresentação; ferramenta calcula pela tabela em memória sem custo interno', async () => {
  let seen;
  const r = await runSimTurn(input([{ role: 'customer', text: 'Quanto fica um trio com som em 10/03/2091 na Cidade Base?' }]), {
    env: { OPENAI_API_KEY: 'x' },
    generateReply: fake(async (a) => { seen = a; const q = await a.executeTool('calcular_orcamento', { formacao: 'Trio', data: '2091-03-10', com_som: true, local: 'Cidade Base' }); return { text: `Oi! Sou a Lia. Total ${q.total}` }; }),
  });
  assert.match(seen.system, /Você é Lia, assistente da Conjunto Exemplo/);
  assert.match(seen.system, /Primeiro contato/);
  assert.equal(r.first_reply, true);
  assert.equal(r.tools[0].result.total, 'R$ 1.720,00');
  assert.doesNotMatch(JSON.stringify(r.tools), /sound_tech|internalCost|R\$ 110,00/);
  assert.equal(r.status, 'replied');
});

test('travas: link bloqueado, pedido de pessoa transfere, opt-out, confirmação supervisionada, conversa com a equipe', async () => {
  const never = async () => { throw new Error('modelo não deveria ser chamado'); };
  const link = await runSimTurn(input([{ role: 'customer', text: 'manda o contrato' }]), { env: {}, generateReply: fake(async () => ({ text: 'https://x.test/contrato/abc' })) });
  assert.deepEqual([link.status, link.reply], ['blocked', '']);
  const human = await runSimTurn(input([{ role: 'customer', text: 'quero falar com uma pessoa' }]), { env: {}, generateReply: never });
  assert.equal(human.status, 'handoff');
  assert.equal(human.handoff.to, 'Responsável Teste');
  const opt = await runSimTurn(input([{ role: 'customer', text: 'não quero mais receber mensagens' }]), { env: {}, generateReply: never });
  assert.equal(opt.status, 'opted_out');
  const conf = await runSimTurn(input([{ role: 'customer', text: 'CONFIRMO' }], { closing_pending: true }), { env: {}, generateReply: never });
  assert.equal(conf.status, 'awaiting_approval');
  assert.doesNotMatch(conf.reply, /contrato\//);
  const held = await runSimTurn(input([{ role: 'customer', text: 'oi' }], { needs_human: true }), { env: {}, generateReply: never });
  assert.equal(held.reason, 'awaiting_human');
});
