import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeSupabase } from './helpers/fake-supabase.mjs';
import { evaluateWhatsappPlanAccess } from '../lib/billing/whatsapp-plan-access.js';

const { checkWorkspaceFeature, checkWorkspaceLimit } = await import('../lib/billing/check-workspace-plan-limit.js');

function evaluate(supabase) {
  return evaluateWhatsappPlanAccess({
    checkFeature: () => checkWorkspaceFeature({ supabase, workspaceId: 'ws-a', feature: 'whatsapp' }),
    checkLimit: () => checkWorkspaceLimit({ supabase, workspaceId: 'ws-a', limitKey: 'whatsapp_messages', increment: 1 }),
  });
}

function world({ planKey = 'free', planSlug = 'free', used = 0 } = {}) {
  const plans = [
    { id: 'p-free', slug: 'free', name: 'Free', can_use_whatsapp: false, max_whatsapp_messages: 100 },
    { id: 'p-starter', slug: 'starter', name: 'Starter', can_use_whatsapp: true, max_whatsapp_messages: 500 },
    { id: 'p-ent', slug: 'enterprise', name: 'Enterprise', can_use_whatsapp: true, max_whatsapp_messages: null },
  ];
  const plan = plans.find((p) => p.slug === planSlug);
  return createFakeSupabase({
    tables: {
      workspaces: [{ id: 'ws-a', plan_key: planKey }],
      workspace_plans: plans,
      workspace_subscriptions: [{ id: 's', workspace_id: 'ws-a', status: 'active', plan_id: plan.id, plan }],
      usage_events: Array.from({ length: used }, (_, i) => ({ id: `u${i}`, workspace_id: 'ws-a', event_type: 'whatsapp_message_sent', quantity: 1, occurred_at: new Date().toISOString() })),
    },
  });
}

test('falta real de plano continua bloqueando (fail-closed): Free sem WhatsApp e cota estourada', async () => {
  const free = await evaluate(world());
  assert.equal(free.allowed, false);
  assert.equal(free.technicalFailure, false);
  assert.equal(free.code, 'FEATURE_NOT_ALLOWED');

  const overQuota = await evaluate(world({ planKey: 'starter', planSlug: 'starter', used: 500 }));
  assert.equal(overQuota.allowed, false);
  assert.equal(overQuota.technicalFailure, false);
  assert.equal(overQuota.code, 'PLAN_LIMIT_REACHED');
});

test('plano pago dentro da cota e workspace interno (Harmonics) enviam normalmente', async () => {
  assert.equal((await evaluate(world({ planKey: 'starter', planSlug: 'starter', used: 10 }))).allowed, true);
  const internal = await evaluate(world({ planKey: 'internal', planSlug: 'enterprise', used: 99999 }));
  assert.equal(internal.allowed, true);
  assert.equal(internal.technicalFailure, false);
});

test('falha técnica ao consultar plano ou uso NÃO bloqueia o envio (fail-open registrado)', async () => {
  const dbDown = {
    from() {
      const failed = { data: null, error: { message: 'connection timeout', code: '57014' } };
      const query = {
        select: () => query, eq: () => query, in: () => query, order: () => query, limit: () => query, gte: () => query,
        maybeSingle: async () => failed,
        then: (resolve) => resolve(failed),
      };
      return query;
    },
  };
  const result = await evaluate(dbDown);
  assert.equal(result.allowed, true);
  assert.equal(result.technicalFailure, true);

  const usageDown = await evaluateWhatsappPlanAccess({
    checkFeature: async () => ({ ok: true, allowed: true }),
    checkLimit: async () => { throw new Error('relation "usage_events" does not exist'); },
  });
  assert.equal(usageDown.allowed, true);
  assert.equal(usageDown.technicalFailure, true);

  const thrown = await evaluateWhatsappPlanAccess({
    checkFeature: async () => { throw new Error('fetch failed'); },
    checkLimit: async () => ({ ok: true, allowed: true }),
  });
  assert.equal(thrown.allowed, true);
  assert.equal(thrown.technicalFailure, true);
});

test('workspace sem plano ativo (NO_ACTIVE_PLAN) é negação de plano, não falha técnica', async () => {
  const noPlan = createFakeSupabase({
    tables: { workspaces: [{ id: 'ws-a', plan_key: 'free' }], workspace_plans: [], workspace_subscriptions: [] },
  });
  const result = await evaluate(noPlan);
  assert.equal(result.allowed, false);
  assert.equal(result.technicalFailure, false);
  assert.equal(result.code, 'NO_ACTIVE_PLAN');

  const limitNoPlan = await evaluateWhatsappPlanAccess({
    checkFeature: async () => ({ ok: true, allowed: true }),
    checkLimit: async () => ({ ok: false, allowed: false, code: 'NO_ACTIVE_PLAN', error: 'Workspace sem plano ativo.' }),
  });
  assert.equal(limitNoPlan.allowed, false);
  assert.equal(limitNoPlan.technicalFailure, false);
});
