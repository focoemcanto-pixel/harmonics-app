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
  assert.match(p, /Repertório e estilos: NUNCA responda "sim, tocamos X"/);
  assert.match(p, /Nunca prometa um vocalista específico/);
  assert.equal(handoffMessage({ handoff_contact_name: 'Responsável Teste' }), 'Combinado! Vou chamar o Responsável Teste para continuar com você por aqui 😊');
  assert.equal(handoffMessage({}), HANDOFF_CUSTOMER_MESSAGE);
  assert.doesNotMatch(HANDOFF_CUSTOMER_MESSAGE, /instantes/);
});

test('ferramenta obrigatória determinística: orçamento, fechamento e CONFIRMO sem resumo', async () => {
  const { requiredToolFor } = await import('../lib/ai/agent/policy.mjs');
  assert.equal(requiredToolFor('Quanto fica um duo no dia 12/09/2027?'), 'calcular_orcamento');
  assert.equal(requiredToolFor('Qual o valor?', { formacao: 'Trio', data_evento: '2027-09-12' }), 'calcular_orcamento');
  assert.equal(requiredToolFor('Queremos fechar!', { formacao: 'Duo', data_evento: '2027-09-12' }), 'preparar_fechamento');
  assert.equal(requiredToolFor('CONFIRMO', { formacao: 'Duo', data_evento: '2027-09-12' }), 'preparar_fechamento');
  // Sem formação+data nada é forçado; "sim" solto não fecha.
  assert.equal(requiredToolFor('Quanto custa?'), null);
  assert.equal(requiredToolFor('Queremos fechar', { formacao: 'Duo' }), null);
  assert.equal(requiredToolFor('sim', { formacao: 'Duo', data_evento: '2027-09-12' }), null);
});

test('tool_choice só é enviado na 1ª rodada e apenas para ferramenta existente', async () => {
  const { generateReply } = await import('../lib/ai/agent/llm.mjs');
  const bodies = [];
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body); bodies.push(body);
    const output = bodies.length === 1
      ? [{ type: 'function_call', name: 'calcular_orcamento', call_id: 'c1', arguments: '{}' }]
      : [{ type: 'message', content: [{ type: 'output_text', text: 'ok' }] }];
    return { ok: true, json: async () => ({ output, output_text: bodies.length === 1 ? '' : 'ok', usage: {} }) };
  };
  const tools = [{ type: 'function', name: 'calcular_orcamento', parameters: { type: 'object', properties: {} } }];
  await generateReply({ system: 's', input: [], tools, executeTool: async () => ({ ok: true }), env: { OPENAI_API_KEY: 'x' }, fetchImpl, toolChoice: 'calcular_orcamento' });
  assert.deepEqual(bodies[0].tool_choice, { type: 'function', name: 'calcular_orcamento' });
  assert.equal(bodies[1].tool_choice, undefined);
  bodies.length = 0;
  await generateReply({ system: 's', input: [], tools, executeTool: async () => ({ ok: true }), env: { OPENAI_API_KEY: 'x' }, fetchImpl, toolChoice: 'inexistente' });
  assert.equal(bodies[0].tool_choice, undefined);
});

test('fechamento confirmado não promete envio de link antes da aprovação', async () => {
  const { PREPARING_MESSAGE } = await import('../lib/ai/commercial/supervision.mjs');
  assert.doesNotMatch(PREPARING_MESSAGE, /link|te envio|envio|já já|em instantes|assim que estiver pronto/i);
  assert.match(PREPARING_MESSAGE, /equipe vai revisar/);
});

test('pagamento: sem regra aprovada não cita percentuais, Pix ou cartão; com regra aprovada, mantém', async () => {
  const { stripUnapprovedPaymentClaims, PAYMENT_DEFERRAL } = await import('../lib/ai/agent/policy.mjs');
  const { hasApprovedPaymentRule } = await import('../lib/ai/commercial/engine.mjs');
  const { formatStrategiesForPrompt } = await import('../lib/ai/commercial/strategies.mjs');
  const reply = 'Entendo! Os valores seguem a tabela. Dá para pagar 50% até duas semanas antes. Também aceitamos Pix e cartão. Quer ver um duo?';
  const out = stripUnapprovedPaymentClaims(reply, { paymentApproved: false });
  assert.doesNotMatch(out, /50%|pix|cart[aã]o/i);
  assert.match(out, /Os valores seguem a tabela\./);
  assert.match(out, /Quer ver um duo\?/);
  assert.ok(out.endsWith(PAYMENT_DEFERRAL));
  assert.equal(stripUnapprovedPaymentClaims(reply, { paymentApproved: true }), reply);
  // "entrada da noiva" não é condição de pagamento.
  const entrada = 'Tocamos na entrada da noiva e na saída dos noivos.';
  assert.equal(stripUnapprovedPaymentClaims(entrada, { paymentApproved: false }), entrada);
  assert.equal(stripUnapprovedPaymentClaims('Sem entrada imediata obrigatória.', { paymentApproved: false }), PAYMENT_DEFERRAL);

  const pending = [{ status: 'pending_approval', kind: 'policy', title: 'Condições de pagamento', content: '50% e Pix' }];
  assert.equal(hasApprovedPaymentRule(pending), false, 'pendente não vale');
  assert.equal(hasApprovedPaymentRule([{ ...pending[0], status: 'active' }]), true);
  const without = formatStrategiesForPrompt(['price_objection'], { paymentApproved: false });
  assert.doesNotMatch(without, /sem entrada imediata obrigatória|ofereça combinar Pix/i);
  assert.match(without, /NÃO cite percentuais/);
  assert.match(formatStrategiesForPrompt(['price_objection']), /EXATAMENTE como estão no conhecimento aprovado/);
});

test('aprovação específica: mudança de data, horário, duração, receptivo, formação ou local é detectada', async () => {
  const { requestSnapshot, snapshotDrift } = await import('../lib/ai/commercial/vocalists.mjs');
  const snap = requestSnapshot({ contact_id: 'c', event_id: 'e', event_date: '2090-01-10', start_time: '16:00:00', duration_min: 60, reception_hours: 0, formation: 'Duo', location: 'Capela X' });
  const ev = { event_date: '2090-01-10', event_time: '16:00', duration_min: 60, reception_hours: null, formation: 'duo', location_name: 'capela x', status: 'confirmado' };
  assert.deepEqual(snapshotDrift(snap, ev), []);
  assert.deepEqual(snapshotDrift(snap, { ...ev, event_date: '2090-01-11', event_time: '17:00', reception_hours: 2 }), ['date', 'time', 'reception_hours']);
  assert.deepEqual(snapshotDrift(snap, { ...ev, duration_min: 90, formation: 'Trio', location_name: 'Outro' }), ['duration_min', 'formation', 'location']);
  assert.deepEqual(snapshotDrift(snap, { ...ev, status: 'cancelado' }), ['evento_cancelado']);
  assert.deepEqual(snapshotDrift(snap, null), ['evento_removido']);
});

test('sem a migração aplicada (tabela inexistente), convites comuns seguem exatamente como hoje', async () => {
  const { guardInviteDispatch, guardInviteResponse } = await import('../lib/ai/commercial/vocalists.mjs');
  const missing = { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.ai_vocalist_requests'" } };
  const chain = new Proxy({}, { get: (_t, k) => (k === 'then' ? (r) => r(missing) : k === 'maybeSingle' ? async () => missing : () => chain) });
  const supabase = { from: () => chain };
  assert.deepEqual(await guardInviteDispatch({ supabase, inviteId: 'x' }), { allow: true, managed: false });
  assert.deepEqual(await guardInviteResponse({ supabase, inviteId: 'x', action: 'accept' }), { allow: true, managed: false });
});
