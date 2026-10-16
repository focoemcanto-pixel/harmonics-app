import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlanSlug } from '../lib/billing/intended-plan.js';

test('plano escolhido: aceita slugs de plano pago e rejeita free/valores inválidos', () => {
  assert.equal(normalizePlanSlug('starter'), 'starter');
  assert.equal(normalizePlanSlug(' PRO '), 'pro');
  assert.equal(normalizePlanSlug('white_label'), 'white_label');
  assert.equal(normalizePlanSlug('free'), '');
  assert.equal(normalizePlanSlug(''), '');
  assert.equal(normalizePlanSlug(null), '');
  assert.equal(normalizePlanSlug('../dashboard'), '');
  assert.equal(normalizePlanSlug('pro"><script>'), '');
  assert.equal(normalizePlanSlug('x'.repeat(41)), '');
});

test('upgrade: identifica bloqueio de plano e monta o link da assinatura com o plano sugerido', async () => {
  const { isPlanBlock, upgradeHref } = await import('../lib/billing/upgrade-prompt.js');
  assert.equal(isPlanBlock({ code: 'PLAN_LIMIT_REACHED' }), true);
  assert.equal(isPlanBlock({ code: 'PLAN_FEATURE_NOT_INCLUDED' }), true);
  assert.equal(isPlanBlock({ code: 'OTHER' }), false);
  assert.equal(isPlanBlock(null), false);
  assert.equal(upgradeHref({ slug: 'starter' }), '/settings/billing?plan=starter');
  assert.equal(upgradeHref(null), '/settings/billing');
  assert.equal(upgradeHref({ slug: '../x' }), '/settings/billing');
});
