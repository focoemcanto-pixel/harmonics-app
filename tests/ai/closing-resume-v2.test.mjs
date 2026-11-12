import test from 'node:test';
import assert from 'node:assert/strict';
import { runNaraV2 } from '../../lib/ai/agent/v2.mjs';

const lead = { _objetivo_comercial: 'closing', data_evento: '2026-11-21', horario: '15:00', cidade: 'Salvador', local: 'Santorini - Itapuã', formacao: 'Trio', instrumentos: 'Voz, piano e violino', som: 'não' };

test('after acceptance, last sound detail resumes simulated closing rather than ending chat', async () => {
  const conversation = { lead_data: { ...lead } };
  const effects = {};
  const called = [];
  const result = await runNaraV2({
    conversation, effects, simulated: true,
    input: [{ role: 'user', content: 'Apenas serviço musical' }],
    execute: async (name) => {
      called.push(name);
      if (name === 'preparar_fechamento') {
        effects.closingSummaryText = 'Simulação de fechamento — confira o resumo. Nenhum pré-contrato ou reserva será criado.';
        return { ok: true };
      }
      return { ok: false };
    },
    agentFactory: () => ({ generate: async () => { throw new Error('Closing must be resumed before another model call'); } }),
  });
  assert.deepEqual(called, ['preparar_fechamento']);
  assert.equal(result.intent, 'closing_summary');
  assert.match(result.text, /Simulação de fechamento/);
});

test('no automatic closing if required event facts are missing', async () => {
  const conversation = { lead_data: { ...lead, horario: null } };
  const called = [];
  const result = await runNaraV2({
    conversation, simulated: true,
    input: [{ role: 'user', content: 'Apenas serviço musical' }],
    execute: async name => { called.push(name); return { ok: false }; },
    agentFactory: () => ({ generate: async () => ({ text: 'Qual o horário da cerimônia?', totalUsage: {} }) }),
  });
  assert.equal(called.includes('preparar_fechamento'), false);
  assert.match(result.text, /horário/);
});

test('closing resumes in same turn after model registers final required field', async () => {
  const conversation = { lead_data: { ...lead, horario: null } };
  const effects = {};
  const called = [];
  const result = await runNaraV2({
    conversation, effects, simulated: true,
    input: [{ role: 'user', content: 'Às 15h' }],
    execute: async (name, args) => {
      called.push(name);
      if (name === 'registrar_dados_evento') { conversation.lead_data.horario = args.horario; return { ok: true }; }
      if (name === 'preparar_fechamento') { effects.closingSummaryText = 'Simulação de fechamento — resumo oficial'; return { ok: true }; }
      return { ok: false };
    },
    agentFactory: cfg => ({ generate: async () => {
      await cfg.tools.registrar_dados_evento.execute({ horario: '15:00' });
      return { text: 'Obrigado, registrei o horário.', totalUsage: {} };
    } }),
  });
  assert.deepEqual(called, ['registrar_dados_evento', 'preparar_fechamento']);
  assert.equal(result.text, 'Simulação de fechamento — resumo oficial');
});
