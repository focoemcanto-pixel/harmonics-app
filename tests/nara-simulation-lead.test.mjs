import test from 'node:test';
import assert from 'node:assert/strict';
import { inferSimulationLead } from '../lib/ai/commercial/simulation-lead.mjs';

test('correção explícita troca chácara e cidade sem reaproveitar local antigo', () => {
  const messages = [
    { role: 'user', content: 'Oi, casamento dia 11/12/2027 na Chácara de Alice' },
    { role: 'assistant', content: 'Em qual cidade?' },
    { role: 'user', content: 'Fica em Feira de Santana, Bahia.' },
    { role: 'assistant', content: 'Não encontrei o local.' },
    { role: 'user', content: 'óh, na verdade é no espaço aliança em salvador' },
  ];
  const out = inferSimulationLead(messages, { local: 'Chácara de Alice', cidade: 'Feira de Santana' });
  assert.equal(out.local.toLowerCase(), 'espaço aliança');
  assert.equal(out.cidade.toLowerCase(), 'salvador');
  assert.equal(out.data_evento, '2027-12-11');
});

test('cidade anterior não sobrevive a correção sem cidade', () => {
  const out = inferSimulationLead([
    { role: 'user', content: 'na Chácara de Alice' },
    { role: 'user', content: 'fica em Feira de Santana' },
    { role: 'user', content: 'na verdade é no Espaço Aliança' },
  ], {});
  assert.equal(out.local, 'Espaço Aliança');
  assert.equal(out.cidade, undefined);
});

test('mensagem sem correção não troca local já confirmado', () => {
  const out = inferSimulationLead([
    { role: 'user', content: 'casamento na Chácara de Alice' },
    { role: 'user', content: 'passaremos perto do Espaço Aliança' },
  ], {});
  assert.equal(out.local, 'Chácara de Alice');
});

test('entende Salvador e Feira de Santana sem nome do espaço para orçamento inicial', () => {
  assert.equal(inferSimulationLead([{ role: 'user', content: 'Salvador' }], {}).cidade, 'Salvador');
  assert.equal(inferSimulationLead([{ role: 'user', content: 'Feira de Santana, Bahia' }], {}).cidade, 'Feira de Santana');
  assert.equal(inferSimulationLead([{ role: 'user', content: 'Camaçari' }], {}).cidade, 'Camaçari');
  assert.equal(inferSimulationLead([{ role: 'user', content: 'na ribeira, phow' }], {}).cidade, undefined);
});
