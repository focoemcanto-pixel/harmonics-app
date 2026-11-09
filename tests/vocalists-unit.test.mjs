// Regras de vocalistas e correções comerciais (dados 100% sintéticos).
import test from 'node:test';
import assert from 'node:assert/strict';
import { busyWindow, overlaps, assessCommitments, priorityFor, voiceOf, normalizeVoice, targetKey } from '../lib/ai/commercial/vocalists.mjs';
import { ensureFirstContactIntro, buildSystemPrompt } from '../lib/ai/agent/prompt.mjs';
import { handoffMessage, HANDOFF_CUSTOMER_MESSAGE } from '../lib/ai/agent/policy.mjs';

const S = { arrival_minutes: 120, schedule_buffer_minutes: 60 };
const RULES = { duo_masculino: 'voz-m', duo_feminino: 'voz-f', reception_masculino: 'voz-m', reception_feminino: 'voz-f' };

test('janela ocupada: chegada antecipada + cerimônia + receptivo + desmontagem + deslocamento', () => {
  const w = busyWindow({ event_time: '16:00', duration_min: 60, reception_hours: 2 }, { arrival: 120, travel: 60 });
  assert.deepEqual([w.from, w.to], [16 * 60 - 180, 16 * 60 + 60 + 120 + 30 + 60]);
  assert.equal(busyWindow({ event_time: null }), null);
});

test('conflitos: simultâneo, próximo (chegada/deslocamento), distante e sem horário', () => {
  const target = { event_id: 'B', time: '17:00', duration_min: 60, reception_hours: 0 };
  const at = (event_time, extra = {}) => ({ event_id: 'A', event_time, duration_min: 60, reception_hours: 0, status: 'confirmed', ...extra });
  assert.equal(assessCommitments({ commitments: [at('17:00')], target, settings: S }).state, 'conflict', 'simultâneo');
  assert.equal(assessCommitments({ commitments: [at('14:00')], target, settings: S }).state, 'conflict', 'próximo: termina 15:00+30+60 > chegada 14:00');
  assert.equal(assessCommitments({ commitments: [at('10:00')], target, settings: S }).state, 'clear', 'manhã distante');
  assert.equal(assessCommitments({ commitments: [at('13:00', { reception_hours: 2 })], target, settings: S }).state, 'conflict', 'receptivo estende a janela');
  assert.equal(assessCommitments({ commitments: [at('17:00', { status: 'pending' })], target, settings: S }).conflicts[0].kind, 'pendente');
  assert.equal(assessCommitments({ commitments: [at('17:00', { status: 'declined' })], target, settings: S }).state, 'clear', 'recusa não conta');
  assert.equal(assessCommitments({ commitments: [at(null)], target, settings: S }).state, 'review', 'sem horário = revisão, nunca disponível');
  assert.equal(assessCommitments({ commitments: [{ event_id: 'B', status: 'declined' }], target, settings: S }).state, 'declined', 'recusou este evento');
  assert.equal(overlaps({ from: 0, to: 10 }, { from: 10, to: 20 }), false);
});

test('prioridades: Duo e receptivo por voz; demais casos = decisão do Owner', () => {
  assert.deepEqual(priorityFor({ formation: 'Duo', voice: 'masculina', rules: RULES }), { contactId: 'voz-m', reason: 'priority_duo' });
  assert.deepEqual(priorityFor({ formation: 'Duo', voice: 'feminina', rules: RULES }), { contactId: 'voz-f', reason: 'priority_duo' });
  assert.deepEqual(priorityFor({ formation: 'Quarteto', receptionHours: 2, voice: 'masculino', rules: RULES }), { contactId: 'voz-m', reason: 'priority_reception' });
  assert.deepEqual(priorityFor({ formation: 'Trio', receptionHours: 1, voice: 'feminino', rules: RULES }), { contactId: 'voz-f', reason: 'priority_reception' });
  assert.equal(priorityFor({ formation: 'Trio', receptionHours: 0, voice: 'masculina', rules: RULES }), null, 'cerimônia sem receptivo: Owner decide');
  assert.equal(priorityFor({ formation: 'Duo', voice: null, rules: RULES }), null, 'sem voz definida: Owner decide');
  assert.equal(priorityFor({ formation: 'Duo', voice: 'masculina', rules: {} }), null, 'sem regra configurada');
  assert.equal(voiceOf({ roles: ['Vocal Feminino'] }), 'feminino');
  assert.equal(voiceOf({ role: 'vocal masculino' }), 'masculino');
  assert.equal(normalizeVoice('Feminina'), 'feminino');
  assert.equal(targetKey({ event_id: 'e1' }), 'event:e1');
  assert.equal(targetKey({ conversation_id: 'c1' }), 'conv:c1');
});

test('correção 1: apresentação garantida no 1º contato, sem duplicar saudação', () => {
  const settings = { assistant_name: 'Lia', assistant_company: 'Conjunto Exemplo' };
  assert.equal(ensureFirstContactIntro('Oi! Para essa data o valor é R$ 10,00.', { settings }), 'Oi! Sou a Lia, assistente da Conjunto Exemplo ☺️ Para essa data o valor é R$ 10,00.');
  assert.equal(ensureFirstContactIntro('Oi! Sou a Lia, assistente. Valor X.', { settings }), 'Oi! Sou a Lia, assistente. Valor X.', 'já apresentada');
  assert.equal(ensureFirstContactIntro('', { settings }), '');
});

test('correções 2, 3, 4, 6 no prompt e 7 na transferência', () => {
  const p = buildSystemPrompt({ settings: { assistant_name: 'Lia' }, companyName: 'X' });
  assert.match(p, /chame calcular_orcamento ANTES de responder/);
  assert.match(p, /nunca diga que uma data, a banda ou um músico está "disponível"/);
  assert.match(p, /chame preparar_fechamento NA MESMA resposta/);
  assert.match(p, /Repertório e estilos: afirme apenas o que estiver no conhecimento aprovado/);
  assert.match(p, /Nunca prometa um vocalista específico/);
  assert.equal(handoffMessage({ handoff_contact_name: 'Responsável Teste' }), 'Combinado! Vou chamar o Responsável Teste para continuar com você por aqui 😊');
  assert.equal(handoffMessage({}), HANDOFF_CUSTOMER_MESSAGE);
  assert.doesNotMatch(HANDOFF_CUSTOMER_MESSAGE, /instantes/);
});
