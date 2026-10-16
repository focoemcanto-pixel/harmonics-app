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
