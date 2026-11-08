// Testes unitários da inteligência comercial (dados 100% sintéticos).
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateQuote, resolveTerritory, computeLogistics, formatBRL, parseInstruments } from '../../lib/ai/commercial/pricing.mjs';
import { evaluateAvailability } from '../../lib/ai/commercial/schedule.mjs';
import { selectKnowledge, detectConflicts, detectIntents } from '../../lib/ai/commercial/knowledge.mjs';
import { selectStrategies, detectObjections, STRATEGIES } from '../../lib/ai/commercial/strategies.mjs';
import { applyMemoryOps } from '../../lib/ai/commercial/memory.mjs';
import { classifyConfirmation, buildClosingSummary, renderSummaryText, hashSummary } from '../../lib/ai/commercial/closing.mjs';
import { patternKey, isMeaningfulEdit } from '../../lib/ai/commercial/learning.mjs';
import { buildOtlpPayload, traceAiReply } from '../../lib/ai/commercial/observability.mjs';
import { summarizePipeline } from '../../lib/ai/commercial/metrics.mjs';
import { parseKnowledgeInput, parseServiceAreaInput, parseMusicianInput } from '../../lib/ai/commercial/admin-input.mjs';
import { detectOptOut, buildHandoffSummary } from '../../lib/ai/agent/policy.mjs';
import { parseSettingsInput } from '../../lib/ai/inbox/settings-input.mjs';

const RULES = [
  { category: 'ceremony', item_key: 'trio', amount: 3000, valid_from: '2020-01-01' },
  { category: 'ceremony', item_key: 'trio', amount: 3300, valid_from: '2099-01-01' },
  { category: 'reception', item_key: 'duo_2h', amount: 1200, valid_from: '2020-01-01' },
  { category: 'sound', item_key: 'church_reception', amount: 700, valid_from: '2020-01-01' },
  { category: 'musician_fee', item_key: 'reception_local', amount: 400, valid_from: '2020-01-01' },
];
const AREAS = [
  { name: 'Cidade Base', match_terms: ['bairro alfa'], status: 'served', active: true },
  { name: 'Cidade Distante', match_terms: [], status: 'served', travel_fee: 500, toll_fee: 80, lodging_required: true, lodging_fee: 900, active: true },
  { name: 'Cidade Condicional', status: 'conditional', travel_fee: 300, active: true },
  { name: 'Cidade Bloqueada', status: 'blocked', active: true },
];
const BASE = { date: '2098-06-10', formation: 'trio', instruments: 'violino, violoncelo e voz', hasSound: true, reception: { formation: 'duo', hours: 2 }, location: 'Igreja X, Cidade Base' };

test('preço: tabela oficial vigente por data, receptivo, som; total determinístico', () => {
  const q = calculateQuote(BASE, { rules: RULES, areas: AREAS });
  assert.equal(q.final, true);
  assert.deepEqual(q.items.map((i) => [i.key, i.amount]), [['ceremony', 3000], ['reception', 1200], ['sound', 700]]);
  assert.equal(q.total, 4900);
  assert.equal(calculateQuote({ ...BASE, date: '2099-02-01' }, { rules: RULES, areas: AREAS }).items[0].amount, 3300, 'regra futura vale a partir da vigência');
  assert.deepEqual(q.sources, { ceremony: 'quote_price_rules', reception: 'quote_price_rules', sound: 'quote_price_rules' });
});

test('preço: fallback para pricing_settings e nunca valor inventado', () => {
  const q = calculateQuote({ ...BASE, hasSound: false, reception: { hours: 0 } }, { rules: [], pricing: { price_trio: 2100 }, areas: AREAS });
  assert.equal(q.items[0].amount, 2100);
  const missing = calculateQuote({ ...BASE, formation: 'quinteto' }, { rules: RULES, pricing: null, areas: AREAS });
  assert.equal(missing.final, false);
  assert.ok(missing.unresolved.includes('ceremony_price_missing'));
  assert.ok(calculateQuote({ ...BASE, formation: 'orquestra' }, { rules: RULES, areas: AREAS }).unresolved.includes('formation_invalid'));
});

test('território: taxa, pedágio e hospedagem; condicional exige aprovação; bloqueado não cota', () => {
  const far = calculateQuote({ ...BASE, location: 'Cidade Distante' }, { rules: RULES, areas: AREAS });
  assert.equal(far.total, 4900 + 500 + 80 + 900);
  const cond = calculateQuote({ ...BASE, location: 'Cidade Condicional' }, { rules: RULES, areas: AREAS });
  assert.equal(cond.final, false);
  assert.ok(cond.approvals.includes('territory_conditional'));
  const blocked = calculateQuote({ ...BASE, location: 'Cidade Bloqueada' }, { rules: RULES, areas: AREAS });
  assert.deepEqual([blocked.ok, blocked.reason], [false, 'territory_blocked']);
  const unknown = calculateQuote({ ...BASE, location: 'Lugar Desconhecido' }, { rules: RULES, areas: AREAS });
  assert.ok(unknown.unresolved.includes('logistics_unresolved'));
  assert.equal(resolveTerritory(AREAS, 'Rua 1, Bairro Alfa').name, 'Cidade Base');
});

test('logística por km com distância rodoviária (ida e volta) e hospedagem por músico', () => {
  const rules = { free_radius_km: 30, per_km_rate: 2, toll_per_km: 0.1, lodging_over_km: 200, lodging_fee_per_musician: 150 };
  const l = computeLogistics({ area: null, rules, routing: { distanceKm: 250 }, musicians: 3 });
  assert.deepEqual(l.items.map((i) => [i.key, i.amount]), [['travel', 880], ['toll', 44], ['lodging', 450]]);
  assert.deepEqual(computeLogistics({ area: null, rules: {}, routing: null }).unresolved, ['logistics_unresolved']);
});

test('margem abaixo do mínimo exige aprovação', () => {
  const q = calculateQuote(BASE, { rules: RULES, areas: AREAS, minMarginPct: 80 });
  assert.ok(q.margin < 80);
  assert.ok(q.approvals.includes('margin_below_minimum'));
  assert.equal(q.final, false);
});

test('instrumentos incompatíveis com a formação exigem aprovação', () => {
  assert.ok(calculateQuote({ ...BASE, instruments: 'violino e voz' }, { rules: RULES, areas: AREAS }).approvals.includes('instruments_mismatch'));
  assert.deepEqual(parseInstruments('violino, violoncelo e voz'), ['violino', 'violoncelo', 'voz']);
  assert.equal(formatBRL(4900.5), 'R$ 4.900,50');
});

test('agenda: disponível, conflito real confirmado, inconclusivo => revisão', () => {
  const req = { date: '2098-06-10', time: '16:00', durationMin: 60, bufferMin: 90 };
  assert.equal(evaluateAvailability([], req).status, 'available');
  assert.equal(evaluateAvailability([{ event_date: '2098-06-10', event_time: '11:00', duration_min: 60, status: 'confirmed' }], req).status, 'available');
  assert.equal(evaluateAvailability([{ event_date: '2098-06-10', event_time: '17:00', duration_min: 60, status: 'confirmado' }], req).status, 'conflict');
  assert.equal(evaluateAvailability([{ event_date: '2098-06-10', event_time: '17:00', duration_min: 60, status: 'pending' }], req).status, 'review');
  assert.equal(evaluateAvailability([{ event_date: '2098-06-10', event_time: null, duration_min: 60, status: 'confirmed' }], req).status, 'review');
  assert.equal(evaluateAvailability([{ event_date: '2098-06-10', event_time: '17:00', duration_min: 60, status: 'recusado' }], req).status, 'available');
  assert.equal(evaluateAvailability([{ event_date: '2098-06-10', event_time: '17:00', duration_min: 60, status: 'confirmed', event_status: 'cancelado' }], req).status, 'available');
});

const KNOW = [
  { id: 'k1', item_key: 'pagamento', kind: 'policy', title: 'Política de pagamento', content: 'Sinal de 50% na assinatura e saldo até 7 dias antes.', intents: ['payment'], priority: 70, status: 'active' },
  { id: 'k2', item_key: 'pagamento-velho', kind: 'policy', title: 'Pagamento antigo', content: 'Pagamento integral no dia.', intents: ['payment'], priority: 40, status: 'active' },
  { id: 'k3', item_key: 'repertorio', kind: 'faq', title: 'Como montar o repertório', content: 'No painel do cliente você monta o cortejo e busca músicas no YouTube.', intents: ['repertoire'], priority: 50, status: 'active' },
  { id: 'k4', item_key: 'pendente', kind: 'faq', title: 'Pendente', content: 'pagamento pix', intents: ['payment'], priority: 99, status: 'pending_approval' },
  { id: 'k5', item_key: 'sempre', kind: 'rule', title: 'Nunca prometer', content: 'Nunca prometer data sem contrato.', intents: [], priority: 95, status: 'active' },
];

test('conhecimento: recuperação seletiva, só ativo, conflito resolvido por prioridade', () => {
  const chosen = selectKnowledge(KNOW, { text: 'Como funciona o pagamento? posso pagar no pix?' });
  const ids = chosen.map((k) => k.id);
  assert.ok(ids.includes('k5'), 'regra de alta prioridade sempre entra');
  assert.ok(ids.includes('k1'));
  assert.ok(!ids.includes('k2'), 'política conflitante de menor prioridade é suprimida');
  assert.ok(!ids.includes('k4'), 'pendente nunca entra');
  assert.ok(!ids.includes('k3'), 'irrelevante fica fora');
  assert.deepEqual(detectIntents('qual o valor do trio com violino?').sort(), ['formation', 'pricing']);
  assert.equal(detectConflicts(KNOW, { item_key: 'novo', kind: 'policy', intents: ['payment'] }).length, 2);
  assert.ok(selectKnowledge(KNOW, { text: 'pagamento '.repeat(5), charBudget: 60 }).length <= 2);
});

test('estratégias sob demanda: no máximo 2, por sinal e etapa, respeitando habilitadas', () => {
  assert.deepEqual(selectStrategies({ stage: 'proposal', text: 'achei caro' }), ['price_objection', 'empathy']);
  assert.deepEqual(selectStrategies({ stage: 'new', text: 'oi' }), ['discovery']);
  assert.deepEqual(selectStrategies({ stage: 'proposal', text: 'achei caro', enabled: ['discovery'] }), []);
  assert.ok(!Object.values(STRATEGIES).some((s) => /desconto (de|exclusivo)|última chance|só hoje/i.test(s.text)), 'sem urgência artificial');
  assert.deepEqual(detectObjections('achei caro e vou pensar'), ['price', 'stall']);
});

test('memória estilo mem0: ADD, UPDATE, DELETE e NONE', () => {
  const { next, events } = applyMemoryOps({ data_evento: '2098-06-10', cidade: 'X' }, { data_evento: '2098-06-12', nome: 'Cliente Teste', cidade: 'remover', som: '' });
  assert.deepEqual(next, { data_evento: '2098-06-12', nome: 'Cliente Teste' });
  assert.deepEqual(events.map((e) => e.op).sort(), ['ADD', 'DELETE', 'UPDATE']);
  assert.equal(applyMemoryOps({ nome: 'A' }, { nome: 'A', campo_invalido: 'x' }).events.length, 0);
});

test('fechamento: confirmação expressa; correções invalidam', () => {
  for (const t of ['CONFIRMO', 'sim', 'Sim, confirmo!', 'tudo certo, pode gerar', 'pode gerar 👍']) assert.equal(classifyConfirmation(t), 'confirm', t);
  for (const t of ['confirmo, mas troca o violino', 'na verdade é dia 12', 'sim mas sem som', 'pode ser', 'ok', 'quanto fica sem receptivo?', '']) assert.equal(classifyConfirmation(t), 'other', t);
});

test('resumo obrigatório: data, formação, instrumentos, músicos, som, receptivo e total; hash estável', async () => {
  const q = calculateQuote(BASE, { rules: RULES, areas: AREAS });
  const summary = buildClosingSummary(q, { time: '16:00', location: BASE.location, musicians: [{ role: 'Voz', name: 'Vocalista Teste' }] });
  const text = renderSummaryText(summary);
  for (const piece of ['10/06/2098', '16:00', 'Trio', 'violino', 'Vocalista Teste', 'Sonorização: incluída', 'Receptivo: Duo', '2h', 'R$ 4.900,00', 'CONFIRMO']) assert.ok(text.includes(piece), piece);
  assert.equal(await hashSummary(summary), await hashSummary(JSON.parse(JSON.stringify(summary))));
  assert.notEqual(await hashSummary(summary), await hashSummary({ ...summary, total: 1 }));
});

test('opt-out e resumo de transferência', () => {
  for (const t of ['PARE', 'não quero mais receber mensagens', 'me tire da lista', 'Não tenho interesse']) assert.ok(detectOptOut(t), t);
  for (const t of ['vou parar pra pensar e te falo', 'pode parar o carro na porta?']) assert.ok(!detectOptOut(t), t);
  const s = buildHandoffSummary({ conversation: { sales_stage: 'negotiation', objections: ['price'], lead_data: { tipo_evento: 'casamento' } }, messages: [{ direction: 'inbound', content: 'quero desconto' }], reason: 'discount_request' });
  assert.match(s, /desconto/i);
  assert.match(s, /negotiation/);
});

test('aprendizado: padrão por tokens e edição relevante', () => {
  assert.equal(patternKey('Vocês tocam em igreja evangélica?'), patternKey('vocês tocam em igreja evangélica'));
  assert.equal(patternKey('oi'), null);
  assert.equal(isMeaningfulEdit('O trio custa a partir de R$ 3.000.', 'O trio custa a partir de R$ 3.000.'), false);
  assert.equal(isMeaningfulEdit('O trio custa a partir de R$ 3.000.', 'Para casamentos indicamos o quarteto, que traz mais presença.'), true);
});

test('observabilidade: OTLP sem conteúdo por padrão; desligada sem chaves', async () => {
  const p = buildOtlpPayload({ name: 'ai.reply', startMs: 1000, endMs: 2000, attributes: { 'gen_ai.usage.input_tokens': 10 } });
  const span = p.resourceSpans[0].scopeSpans[0].spans[0];
  assert.equal(span.traceId.length, 32);
  assert.equal(span.endTimeUnixNano, '2000000000');
  assert.deepEqual(await traceAiReply({ env: {}, startMs: 0 }), { sent: false, reason: 'disabled' });
  let sentBody = null;
  const env = { LANGFUSE_BASE_URL: 'https://lf.example.test', LANGFUSE_PUBLIC_KEY: 'pk', LANGFUSE_SECRET_KEY: 'sk' };
  await traceAiReply({ env, startMs: 0, attributes: { a: 1 }, content: { input: 'dado pessoal', output: 'x' }, fetchImpl: async (url, init) => { sentBody = { url, body: init.body, auth: init.headers.Authorization }; return { ok: true, status: 200 }; } });
  assert.match(sentBody.url, /\/api\/public\/otel\/v1\/traces$/);
  assert.ok(!sentBody.body.includes('dado pessoal'), 'LGPD: conteúdo não enviado por padrão');
  assert.equal(sentBody.auth, `Basic ${btoa('pk:sk')}`);
});

test('métricas do funil, recuperação e custos', () => {
  const m = summarizePipeline({
    conversations: [{ sales_stage: 'proposal', objections: ['price'] }, { sales_stage: 'contract_sent' }, { sales_stage: 'lost', lost_reason: 'data' }, { sales_stage: 'new', needs_human: true }],
    followups: [{ status: 'sent', recovered: true }, { status: 'sent' }, { status: 'scheduled' }],
    usage: [{ kind: 'reply', input_tokens: 100, output_tokens: 20, cost_usd: 0.01 }],
    outbox: [{ sender_type: 'ai', status: 'sent' }, { sender_type: 'ai', status: 'cancelled', last_error: 'discarded' }],
  });
  assert.equal(m.conversionRate, 25);
  assert.deepEqual(m.followups, { scheduled: 1, sent: 2, recovered: 1, recoveryRate: 50 });
  assert.equal(m.cost.tokensIn, 100);
  assert.equal(m.quality.discardedDrafts, 1);
  assert.deepEqual(m.lostReasons, { data: 1 });
});

test('entradas do painel e configurações comerciais saneadas', () => {
  assert.equal(parseKnowledgeInput({ kind: 'x', title: 'a', content: 'b' }).error !== undefined, true);
  const k = parseKnowledgeInput({ kind: 'rider', title: 'Rider trio', content: '2 tomadas', formation: 'Trio', service: 'cerimonia', intents: 'rider, Sound', priority: 500 });
  assert.deepEqual([k.metadata, k.intents, k.priority], [{ formation: 'trio', service: 'cerimonia' }, ['rider', 'sound'], 100]);
  assert.equal(parseServiceAreaInput({ name: 'A', status: 'zzz', travel_fee: '' }).status, 'served');
  assert.equal(parseServiceAreaInput({ name: 'A', travel_fee: '' }).travel_fee, null);
  assert.deepEqual(parseMusicianInput({ contact_id: 'c', display_name: 'M', video_urls: 'http://inseguro, https://video.example.test/1' }).video_urls, ['https://video.example.test/1']);
  const s = parseSettingsInput({ followup_days: [2, 5, 10, 99, 0], followup_templates: ['Retorno 1!', 'x'], strategies_enabled: ['empathy', 'hack'], logistics_rules: { per_km_rate: '2', origin: 'Cidade Base' }, min_margin_pct: 200, autonomous_closing_enabled: true });
  assert.deepEqual(s.followup_days, [2, 5, 10]);
  assert.deepEqual(s.followup_templates, ['retorno1', 'x']);
  assert.deepEqual(s.strategies_enabled, ['empathy']);
  assert.deepEqual(s.logistics_rules, { per_km_rate: 2, origin: 'Cidade Base' });
  assert.equal(s.min_margin_pct, 95);
  assert.equal(s.autonomous_closing_enabled, true);
});

test('bootstrap: remove valores dinâmicos, extrai cláusulas e cidades', async () => {
  const { sanitizeStaticText, extractContractClauses, cityFromAddress, buildBootstrapCandidates } = await import('../../lib/ai/commercial/bootstrap.mjs');
  const s = sanitizeStaticText('Sinal de {{valor_sinal}} e saldo de R$ 1.500,00 até 10/06/2098, contato (11) 91234-5678.');
  assert.ok(!/R\$|\{\{|2098|91234/.test(s.text));
  assert.deepEqual(s.removed.sort(), ['currency', 'date', 'phone', 'template_variable']);
  assert.equal(sanitizeStaticText('R$ 10').text, null);
  const clauses = extractContractClauses('<p>O pagamento será por PIX com sinal na assinatura do contrato.</p><p>O CONTRATANTE fornecerá energia elétrica e cobertura no local.</p>');
  assert.deepEqual(clauses.map((c) => c.topic.key), ['payment', 'structure']);
  assert.equal(cityFromAddress('Rua 1, 100 - Cidade Alfa - BA'), 'Cidade Alfa - BA');
  assert.equal(cityFromAddress('sem cidade'), null);
  const { candidates } = await buildBootstrapCandidates({ eventTypes: [{ name: 'Casamento' }], contracts: [], messages: [], moments: [], addresses: [] });
  const again = await buildBootstrapCandidates({ eventTypes: [{ name: 'Casamento' }], contracts: [], messages: [], moments: [], addresses: [] });
  assert.deepEqual(candidates.map((c) => c.item_key), again.candidates.map((c) => c.item_key), 'item_key determinístico');
});

test('bootstrap v2: contradição número x extenso, escopo por modelo e mensagens como tom', async () => {
  const { detectNumberWordMismatches, parsePtNumber, templateScope, matchesScope, buildBootstrapCandidates } = await import('../../lib/ai/commercial/bootstrap.mjs');
  assert.deepEqual(detectNumberWordMismatches('multa de 50% (trinta por cento)').map((m) => [m.digits, m.parsed]), [[50, 30]]);
  assert.deepEqual(detectNumberWordMismatches('multa de 30% (trinta por cento) e 15 (quinze) dias'), []);
  assert.equal(parsePtNumber('vinte e cinco'), 25);
  const types = [{ id: 'e1', name: 'Casamento', default_contract_template_id: 't1' }, { id: 'e2', name: 'Aniversário', default_contract_template_id: null }];
  assert.deepEqual(templateScope({ id: 't1', name: 'Padrão' }, types).event_types, ['Casamento']);
  assert.equal(templateScope({ id: 't2', name: 'Contrato padrão aniversário' }, types).classified_by, 'template_name');
  assert.equal(templateScope({ id: 't3', name: 'Outro' }, types).classified_by, null);
  assert.equal(matchesScope({ metadata: { scope: { event_types: ['Aniversário'] } } }, 'Casamento'), false);
  assert.equal(matchesScope({ metadata: {} }, 'Casamento'), true);
  const { candidates } = await buildBootstrapCandidates({
    eventTypes: types,
    contracts: [
      { id: 't1', name: 'Padrão', content: '<p>Cancelamento com menos de 30 dias implica multa de 50% (trinta por cento) do valor.</p>' },
      { id: 't3', name: 'Outro', content: '<p>O pagamento será feito por PIX com sinal na assinatura do contrato.</p>' },
    ],
    messages: [{ id: 'm1', key: 'payment_due_2_days_client_whatsapp', name: 'Lembrete', recipient_type: 'client', body: 'Olá! Seu pagamento vence em breve, qualquer dúvida estamos à disposição por aqui.' }],
    moments: [], addresses: [],
  });
  const cancel = candidates.find((c) => c.title.startsWith('Cancelamento'));
  assert.deepEqual([cancel.metadata.scope.event_types, cancel.metadata.review.required], [['Casamento'], true]);
  assert.ok(cancel.metadata.review.flags.includes('number_word_mismatch'));
  const pay = candidates.find((c) => c.title.startsWith('Condições de pagamento'));
  assert.ok(pay.metadata.review.flags.includes('unclassified_scope') && pay.metadata.review.flags.includes('contract_specific_terms'));
  const msg = candidates.find((c) => c.metadata.origin.table === 'message_templates');
  assert.deepEqual([msg.kind, msg.intents], ['style', []]);
});
