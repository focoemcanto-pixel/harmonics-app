import test from 'node:test';
import assert from 'node:assert/strict';
import { cancelSupersededPendingCheckout } from '../lib/billing/pending-checkout.js';

test('novo checkout cancela a assinatura pendente anterior no Asaas (evita cobrança dupla)', async () => {
  const calls = [];
  const cancel = async (id) => { calls.push(id); };
  assert.deepEqual(await cancelSupersededPendingCheckout({ pending: { provider_subscription_id: 'sub_old' }, activeProviderSubscriptionId: null, cancelSubscription: cancel }), { ok: true, canceled: 'sub_old' });
  assert.deepEqual(calls, ['sub_old']);
});

test('não cancela nada sem pendente, nem a assinatura paga ativa', async () => {
  const cancel = async () => { throw new Error('não deveria chamar'); };
  assert.equal((await cancelSupersededPendingCheckout({ pending: null, cancelSubscription: cancel })).skipped, true);
  assert.equal((await cancelSupersededPendingCheckout({ pending: { provider_subscription_id: 'sub_a' }, activeProviderSubscriptionId: 'sub_a', cancelSubscription: cancel })).skipped, true);
});

test('404 no Asaas conta como já cancelada; outro erro bloqueia o novo checkout', async () => {
  const gone = async () => { const e = new Error('not found'); e.providerStatus = 404; throw e; };
  assert.equal((await cancelSupersededPendingCheckout({ pending: { provider_subscription_id: 'x' }, cancelSubscription: gone })).ok, true);
  const down = async () => { const e = new Error('timeout'); e.providerStatus = 500; throw e; };
  assert.equal((await cancelSupersededPendingCheckout({ pending: { provider_subscription_id: 'x' }, cancelSubscription: down })).ok, false);
});
