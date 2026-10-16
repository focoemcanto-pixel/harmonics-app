import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeSupabase } from './helpers/fake-supabase.mjs';
import { reduceSubscriptionEvent, describeAsaasEvent, resolveEffectivePlan, parseProviderDate } from '../lib/billing/subscription-state.js';

const { processAsaasWebhook, authenticateAsaasWebhook } = await import('../lib/billing/process-asaas-webhook.js');

const FREE = { id: 'plan-free', slug: 'free', max_events_per_month: 10 };
const PRO = { id: 'plan-pro', slug: 'pro', max_events_per_month: 100 };

function freeSubscriptionWithPendingCheckout() {
  return {
    id: 'sub-1',
    workspace_id: 'ws-a',
    plan_id: FREE.id,
    status: 'active',
    provider_subscription_id: null,
    metadata: { pending_checkout: { plan_id: PRO.id, provider_subscription_id: 'asaas-sub-1', provider_customer_id: 'cus-1' } },
  };
}

const evt = (id, type, dateCreated, extra = {}) => ({
  id, event: type, dateCreated,
  payment: { id: `pay-${id}`, subscription: 'asaas-sub-1', externalReference: 'ws-a', dueDate: '2026-10-20', paymentDate: '2026-10-14', status: 'CONFIRMED', ...extra },
});

test('pagamento confirmado ativa o plano do checkout pendente', () => {
  const result = reduceSubscriptionEvent(freeSubscriptionWithPendingCheckout(), describeAsaasEvent(evt('e1', 'PAYMENT_CONFIRMED', '2026-10-14 10:00:00')));
  assert.equal(result.action, 'apply');
  assert.equal(result.patch.plan_id, PRO.id);
  assert.equal(result.patch.status, 'active');
  assert.equal(result.patch.provider_subscription_id, 'asaas-sub-1');
  assert.equal(result.patch.metadata.pending_checkout, undefined);
  assert.ok(new Date(result.patch.current_period_end) > new Date('2026-11-19'));
});

test('cobrança criada/atrasada de checkout ainda não pago não muda o plano atual', () => {
  const sub = freeSubscriptionWithPendingCheckout();
  assert.equal(reduceSubscriptionEvent(sub, describeAsaasEvent(evt('e0', 'PAYMENT_CREATED', '2026-10-14 09:00:00'))).action, 'ignore');
  assert.equal(reduceSubscriptionEvent(sub, describeAsaasEvent(evt('e0b', 'PAYMENT_OVERDUE', '2026-10-21 09:00:00'))).action, 'ignore');
});

test('evento mais antigo que o último aplicado é ignorado (fora de ordem)', () => {
  const active = { id: 'sub-1', plan_id: PRO.id, status: 'active', provider_subscription_id: 'asaas-sub-1', last_provider_event_at: '2026-11-20T12:00:00Z', metadata: {} };
  const late = describeAsaasEvent(evt('e9', 'PAYMENT_OVERDUE', '2026-10-25 10:00:00'));
  assert.deepEqual(reduceSubscriptionEvent(active, late), { action: 'ignore', reason: 'out_of_order' });
});

test('atraso → past_due; dentro da carência mantém plano; após carência limites do Free', () => {
  const active = { id: 'sub-1', plan_id: PRO.id, status: 'active', provider_subscription_id: 'asaas-sub-1', current_period_end: '2026-11-20T00:00:00Z', metadata: {} };
  const overdue = reduceSubscriptionEvent(active, describeAsaasEvent(evt('e2', 'PAYMENT_OVERDUE', '2026-11-21 08:00:00')));
  assert.equal(overdue.patch.status, 'past_due');
  const pastDue = { ...active, ...overdue.patch };
  assert.equal(resolveEffectivePlan({ subscription: pastDue, plan: PRO, freePlan: FREE, now: new Date('2026-11-24') }).plan.slug, 'pro');
  assert.equal(resolveEffectivePlan({ subscription: pastDue, plan: PRO, freePlan: FREE, now: new Date('2026-12-01') }).plan.slug, 'free');
  // regularização
  const paid = reduceSubscriptionEvent(pastDue, describeAsaasEvent(evt('e3', 'PAYMENT_RECEIVED', '2026-12-02 08:00:00', { dueDate: '2026-11-20' })));
  assert.equal(paid.patch.status, 'active');
});

test('cancelamento mantém acesso até o fim do período e depois volta ao Free; reativação limpa o cancelamento', () => {
  const active = { id: 'sub-1', plan_id: PRO.id, status: 'active', provider_subscription_id: 'asaas-sub-1', current_period_end: '2026-11-20T00:00:00Z', metadata: {} };
  const canceled = reduceSubscriptionEvent(active, describeAsaasEvent({ id: 'e4', event: 'SUBSCRIPTION_DELETED', dateCreated: '2026-11-01 10:00:00', subscription: { id: 'asaas-sub-1' } }));
  const after = { ...active, ...canceled.patch };
  assert.equal(after.cancel_at_period_end, true);
  assert.equal(resolveEffectivePlan({ subscription: after, plan: PRO, freePlan: FREE, now: new Date('2026-11-10') }).plan.slug, 'pro');
  assert.equal(resolveEffectivePlan({ subscription: after, plan: PRO, freePlan: FREE, now: new Date('2026-11-21') }).plan.slug, 'free');
  const resub = { ...after, metadata: { pending_checkout: { plan_id: PRO.id, provider_subscription_id: 'asaas-sub-2' } } };
  const paid = reduceSubscriptionEvent(resub, describeAsaasEvent({ id: 'e5', event: 'PAYMENT_CONFIRMED', dateCreated: '2026-11-25 10:00:00', payment: { id: 'p', subscription: 'asaas-sub-2', dueDate: '2026-11-25' } }));
  assert.equal(paid.patch.cancel_at_period_end, false);
  assert.equal(paid.patch.provider_subscription_id, 'asaas-sub-2');
});

test('workspace interno (operação original) nunca é limitado', () => {
  const result = resolveEffectivePlan({ subscription: { status: 'canceled' }, plan: FREE, freePlan: FREE, workspace: { plan_key: 'internal' } });
  assert.equal(result.plan.unlimited, true);
});

test('datas do Asaas são interpretadas no fuso de Brasília', () => {
  assert.equal(parseProviderDate('2026-10-14 10:00:00').toISOString(), '2026-10-14T13:00:00.000Z');
});

test('webhook: autenticação obrigatória e falha fechada sem segredo', () => {
  const headers = (token) => new Headers(token ? { 'asaas-access-token': token } : {});
  assert.equal(authenticateAsaasWebhook(headers('x'), '').status, 503);
  assert.equal(authenticateAsaasWebhook(headers('errado'), 'certo').status, 401);
  assert.equal(authenticateAsaasWebhook(headers(), 'certo').status, 401);
  assert.equal(authenticateAsaasWebhook(headers('certo'), 'certo').ok, true);
});

test('webhook: mesmo evento 2x não reprocessa; retry/duplicata é idempotente', async () => {
  const supabase = createFakeSupabase({
    tables: { billing_events: [], workspace_subscriptions: [freeSubscriptionWithPendingCheckout()] },
    unique: { billing_events: ['event_id'] },
  });
  const payload = evt('evt-1', 'PAYMENT_CONFIRMED', '2026-10-14 10:00:00');
  const first = await processAsaasWebhook({ supabase, payload });
  assert.equal(first.httpStatus, 200);
  assert.equal(first.body.applied, 'PAYMENT_CONFIRMED');
  const second = await processAsaasWebhook({ supabase, payload });
  assert.equal(second.body.duplicate, true);
  const [row] = (await supabase.from('workspace_subscriptions').select('*').eq('id', 'sub-1')).data;
  assert.equal(row.plan_id, PRO.id);
  assert.equal(supabase.stats.inserts.billing_events, 1);
});

const { checkPlanLimit } = await import('../lib/billing/plan-limits.js');

function limitWorld({ planKey = 'free', planSlug = 'free', eventsThisMonth = 10 } = {}) {
  const month = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 2)).toISOString();
  const plans = [
    { id: 'plan-free', slug: 'free', name: 'Free', max_events_per_month: 10, max_members: 2 },
    { id: 'plan-ent', slug: 'enterprise', name: 'Enterprise', max_events_per_month: null, max_members: null },
  ];
  const plan = plans.find((p) => p.slug === planSlug);
  return createFakeSupabase({
    tables: {
      workspaces: [{ id: 'ws-a', plan_key: planKey }],
      workspace_plans: plans,
      workspace_subscriptions: [{ id: 's', workspace_id: 'ws-a', status: 'active', plan_id: plan.id, plan }],
      events: Array.from({ length: eventsThisMonth }, (_, i) => ({ id: `e${i}`, workspace_id: 'ws-a', created_at: month })),
      workspace_members: [{ id: 'm1', workspace_id: 'ws-a', status: 'active' }, { id: 'm2', workspace_id: 'ws-a', status: 'active' }],
    },
  });
}

test('limite no backend: Free com 10 eventos no mês bloqueia o 11º (402)', async () => {
  process.env.ENFORCE_WORKSPACE_PLANS = 'true';
  const blocked = await checkPlanLimit({ supabase: limitWorld({ eventsThisMonth: 10 }), workspaceId: 'ws-a', limitKey: 'events_per_month' });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 402);
  assert.equal(blocked.code, 'PLAN_LIMIT_REACHED');
  const allowed = await checkPlanLimit({ supabase: limitWorld({ eventsThisMonth: 9 }), workspaceId: 'ws-a', limitKey: 'events_per_month' });
  assert.equal(allowed.ok, true);
});

test('limite de membros e planos ilimitados/internos', async () => {
  assert.equal((await checkPlanLimit({ supabase: limitWorld(), workspaceId: 'ws-a', limitKey: 'members' })).ok, false);
  assert.equal((await checkPlanLimit({ supabase: limitWorld({ planSlug: 'enterprise', eventsThisMonth: 500 }), workspaceId: 'ws-a', limitKey: 'events_per_month' })).ok, true);
  assert.equal((await checkPlanLimit({ supabase: limitWorld({ planKey: 'internal', eventsThisMonth: 500 }), workspaceId: 'ws-a', limitKey: 'events_per_month' })).ok, true);
});

test('sem ENFORCE_WORKSPACE_PLANS=true o limite só é registrado (mesma semântica de produção)', async () => {
  delete process.env.ENFORCE_WORKSPACE_PLANS;
  const soft = await checkPlanLimit({ supabase: limitWorld({ eventsThisMonth: 10 }), workspaceId: 'ws-a', limitKey: 'events_per_month' });
  assert.equal(soft.ok, true);
  assert.equal(soft.soft, true);
  process.env.ENFORCE_WORKSPACE_PLANS = 'true';
});

test('erro ao ler o workspace não rebaixa para Free: libera (fail-open)', async () => {
  const failing = {
    from(table) {
      const result = table === 'workspaces' ? { data: null, error: { message: 'timeout' } } : { data: null, error: null };
      const query = {
        select: () => query, eq: () => query, in: () => query, order: () => query, limit: () => query, gte: () => query,
        maybeSingle: async () => result,
      };
      return query;
    },
  };
  const result = await checkPlanLimit({ supabase: failing, workspaceId: 'ws-a', limitKey: 'events_per_month' });
  assert.equal(result.ok, true);
  assert.equal(result.checkFailed, true);
});

test('webhook: workspace cancelado reassina — pagamento do novo checkout reativa a mesma linha', async () => {
  const canceled = { ...freeSubscriptionWithPendingCheckout(), status: 'cancelled', provider_subscription_id: 'asaas-old' };
  const supabase = createFakeSupabase({
    tables: { billing_events: [], workspace_subscriptions: [canceled] },
    unique: { billing_events: ['event_id'] },
  });
  const result = await processAsaasWebhook({ supabase, payload: evt('evt-re', 'PAYMENT_CONFIRMED', '2026-10-14 10:00:00') });
  assert.equal(result.body.applied, 'PAYMENT_CONFIRMED');
  const [row] = (await supabase.from('workspace_subscriptions').select('*').eq('id', 'sub-1')).data;
  assert.equal(row.status, 'active');
  assert.equal(row.plan_id, PRO.id);
  assert.equal(row.provider_subscription_id, 'asaas-sub-1');
});

test('loadLatestSubscriptionRow encontra assinatura cancelada (base da reassinatura)', async () => {
  const { loadLatestSubscriptionRow, loadWorkspaceBilling } = await import('../lib/billing/plan-limits.js');
  const supabase = createFakeSupabase({
    tables: {
      workspaces: [{ id: 'ws-a', plan_key: 'free' }],
      workspace_plans: [{ id: 'plan-free', slug: 'free' }],
      workspace_subscriptions: [{ id: 'sub-c', workspace_id: 'ws-a', status: 'cancelled' }],
    },
  });
  assert.equal((await loadWorkspaceBilling({ supabase, workspaceId: 'ws-a' })).subscription, null);
  assert.equal((await loadLatestSubscriptionRow({ supabase, workspaceId: 'ws-a' })).id, 'sub-c');
});

const { checkWorkspaceFeature, checkWorkspaceLimit } = await import('../lib/billing/check-workspace-plan-limit.js');

function whatsappWorld({ planKey = 'starter', status = 'active', periodEnd = null, cancelAtPeriodEnd = false, usedMessages = 0 } = {}) {
  const plans = [
    { id: 'plan-free', slug: 'free', name: 'Free', can_use_whatsapp: false, max_whatsapp_messages: 100 },
    { id: 'plan-starter', slug: 'starter', name: 'Starter', can_use_whatsapp: true, max_whatsapp_messages: 500 },
  ];
  const plan = plans[1];
  return createFakeSupabase({
    tables: {
      workspaces: [{ id: 'ws-a', plan_key: planKey }],
      workspace_plans: plans,
      workspace_subscriptions: [{ id: 's', workspace_id: 'ws-a', status, plan_id: plan.id, plan, current_period_end: periodEnd, cancel_at_period_end: cancelAtPeriodEnd }],
      usage_events: Array.from({ length: usedMessages }, (_, i) => ({ id: `u${i}`, workspace_id: 'ws-a', event_type: 'whatsapp_message_sent', quantity: 1, occurred_at: new Date().toISOString() })),
    },
  });
}

test('WhatsApp usa o plano efetivo: pago ativo libera; cancelado no fim do período e atraso fora da carência voltam ao Free', async () => {
  const past = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  assert.equal((await checkWorkspaceFeature({ supabase: whatsappWorld(), workspaceId: 'ws-a', feature: 'whatsapp' })).allowed, true);
  assert.equal((await checkWorkspaceFeature({ supabase: whatsappWorld({ cancelAtPeriodEnd: true, periodEnd: past }), workspaceId: 'ws-a', feature: 'whatsapp' })).allowed, false);
  assert.equal((await checkWorkspaceFeature({ supabase: whatsappWorld({ status: 'past_due', periodEnd: past }), workspaceId: 'ws-a', feature: 'whatsapp' })).allowed, false);
  const inGrace = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
  assert.equal((await checkWorkspaceFeature({ supabase: whatsappWorld({ status: 'past_due', periodEnd: inGrace }), workspaceId: 'ws-a', feature: 'whatsapp' })).allowed, true);
});

test('WhatsApp: cota mensal do plano e workspace interno ilimitado', async () => {
  assert.equal((await checkWorkspaceLimit({ supabase: whatsappWorld({ usedMessages: 499 }), workspaceId: 'ws-a', limitKey: 'whatsapp_messages' })).allowed, true);
  assert.equal((await checkWorkspaceLimit({ supabase: whatsappWorld({ usedMessages: 500 }), workspaceId: 'ws-a', limitKey: 'whatsapp_messages' })).allowed, false);
  const internal = whatsappWorld({ planKey: 'internal', usedMessages: 5000 });
  assert.equal((await checkWorkspaceFeature({ supabase: internal, workspaceId: 'ws-a', feature: 'whatsapp' })).allowed, true);
  assert.equal((await checkWorkspaceLimit({ supabase: internal, workspaceId: 'ws-a', limitKey: 'whatsapp_messages' })).allowed, true);
});

const { checkPlanFeature } = await import('../lib/billing/plan-limits.js');

function featureWorld({ planKey = 'free', planSlug = 'free' } = {}) {
  const plans = [
    { id: 'plan-free', slug: 'free', name: 'Free', can_use_automation: false, can_use_whatsapp: false },
    { id: 'plan-starter', slug: 'starter', name: 'Starter', can_use_automation: true, can_use_whatsapp: true },
  ];
  const plan = plans.find((p) => p.slug === planSlug);
  return createFakeSupabase({
    tables: {
      workspaces: [{ id: 'ws-a', plan_key: planKey }],
      workspace_plans: plans,
      workspace_subscriptions: [{ id: 's', workspace_id: 'ws-a', status: 'active', plan_id: plan.id, plan }],
    },
  });
}

test('recursos do plano no backend: Free não cria automação/canal de WhatsApp (402); pago e interno liberam', async () => {
  process.env.ENFORCE_WORKSPACE_PLANS = 'true';
  const blocked = await checkPlanFeature({ supabase: featureWorld(), workspaceId: 'ws-a', feature: 'automation' });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 402);
  assert.equal(blocked.code, 'PLAN_FEATURE_NOT_INCLUDED');
  assert.match(blocked.error, /Free não inclui automações/);
  assert.equal((await checkPlanFeature({ supabase: featureWorld(), workspaceId: 'ws-a', feature: 'whatsapp' })).ok, false);
  assert.equal((await checkPlanFeature({ supabase: featureWorld({ planSlug: 'starter' }), workspaceId: 'ws-a', feature: 'automation' })).ok, true);
  assert.equal((await checkPlanFeature({ supabase: featureWorld({ planKey: 'internal' }), workspaceId: 'ws-a', feature: 'whatsapp' })).ok, true);

  process.env.ENFORCE_WORKSPACE_PLANS = '';
  const soft = await checkPlanFeature({ supabase: featureWorld(), workspaceId: 'ws-a', feature: 'automation' });
  assert.equal(soft.ok, true);
  assert.equal(soft.wouldBlock.code, 'PLAN_FEATURE_NOT_INCLUDED');
});

test('bloqueio de plano sugere o plano pago mais barato que resolve (limite e recurso)', async () => {
  process.env.ENFORCE_WORKSPACE_PLANS = 'true';
  const month = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 2)).toISOString();
  const plans = [
    { id: 'p0', slug: 'free', name: 'Free', monthly_price: 0, is_public: true, sort_order: 0, max_events_per_month: 10, can_use_automation: false },
    { id: 'p1', slug: 'starter', name: 'Starter', monthly_price: 97, is_public: true, sort_order: 10, max_events_per_month: 30, can_use_automation: true },
    { id: 'p2', slug: 'pro', name: 'Pro', monthly_price: 197, is_public: true, sort_order: 20, max_events_per_month: 100, can_use_automation: true },
  ];
  const world = (events) => createFakeSupabase({
    tables: {
      workspaces: [{ id: 'ws-a', plan_key: 'free' }],
      workspace_plans: plans,
      workspace_subscriptions: [{ id: 's', workspace_id: 'ws-a', status: 'active', plan_id: 'p0', plan: plans[0] }],
      events: Array.from({ length: events }, (_, i) => ({ id: `e${i}`, workspace_id: 'ws-a', created_at: month })),
    },
  });
  const limit = await checkPlanLimit({ supabase: world(10), workspaceId: 'ws-a', limitKey: 'events_per_month' });
  assert.equal(limit.ok, false);
  assert.deepEqual(limit.suggestedPlan, { slug: 'starter', name: 'Starter' });
  const feature = await checkPlanFeature({ supabase: world(0), workspaceId: 'ws-a', feature: 'automation' });
  assert.deepEqual(feature.suggestedPlan, { slug: 'starter', name: 'Starter' });
});
