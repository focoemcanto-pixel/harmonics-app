import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPARISON_ROWS, formatMoney, isPaidPlan, planFeatureList } from '../lib/billing/plan-presentation.js';

const starter = { slug: 'starter', monthly_price: '97', max_events_per_month: 30, max_members: 5, max_whatsapp_messages: 500, can_use_contracts: true, can_use_automation: true, can_use_whatsapp: true, can_use_white_label: false };
const enterprise = { ...starter, slug: 'enterprise', monthly_price: '497', max_events_per_month: null, max_members: null, max_whatsapp_messages: null };
const free = { ...starter, slug: 'free', monthly_price: '0', can_use_automation: false, can_use_whatsapp: false, max_whatsapp_messages: 100 };

test('preço exibido vem do valor do plano, sem centavos quando inteiro', () => {
  assert.equal(formatMoney('97').replace(/\s/g, ' '), 'R$ 97');
  assert.equal(formatMoney(97.5).replace(/\s/g, ' '), 'R$ 97,50');
  assert.equal(isPaidPlan(free), false);
  assert.equal(isPaidPlan(starter), true);
});

test('itens do cartão refletem limites e recursos do banco', () => {
  const texts = planFeatureList(starter).map((item) => item.text);
  assert.ok(texts.includes('30 eventos por mês'));
  assert.ok(texts.includes('5 membros na equipe'));
  assert.ok(texts.some((text) => text.includes('500 mensagens/mês')));
  const freeWhatsapp = planFeatureList(free).find((item) => item.text.startsWith('WhatsApp'));
  assert.equal(freeWhatsapp.included, false);
  assert.ok(planFeatureList(enterprise).some((item) => item.text === 'Eventos por mês ilimitados'));
});

test('tabela comparativa usa os mesmos campos', () => {
  const values = COMPARISON_ROWS.map((row) => row.value(enterprise));
  assert.deepEqual(values.slice(0, 2), ['Ilimitados', 'Ilimitados']);
  assert.equal(COMPARISON_ROWS.find((row) => row.label === 'WhatsApp integrado').value(free), false);
});
