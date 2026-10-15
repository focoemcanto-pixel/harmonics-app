// Máquina de estados da assinatura (Asaas → workspace_subscriptions). Módulo puro: sem I/O.
//
// Status canônicos: 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused'.
// ('cancelled' com dois "l" é legado e é normalizado para 'canceled'.)

export const GRACE_DAYS_PAST_DUE = 7;

const PAID_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED']);
const OVERDUE_EVENTS = new Set(['PAYMENT_OVERDUE']);
const REVERSAL_EVENTS = new Set(['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_RECEIVED_IN_CASH_UNDONE']);
const CANCEL_EVENTS = new Set(['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED']);

export function normalizeStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'cancelled') return 'canceled';
  return value || 'active';
}

// "2024-06-12 16:45:03" (fuso de Brasília, formato Asaas) ou ISO → Date | null
export function parseProviderDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(raw) ? `${raw.replace(' ', 'T')}-03:00` : raw;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function addMonths(date, months = 1) {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCMonth(result.getUTCMonth() + months);
  if (result.getUTCDate() < day) result.setUTCDate(0);
  return result;
}

// Extrai o essencial de um payload de webhook Asaas.
export function describeAsaasEvent(payload = {}) {
  const eventType = String(payload?.event || '').trim().toUpperCase();
  const payment = payload?.payment || null;
  const subscription = payload?.subscription || null;
  return {
    eventId: String(payload?.id || '').trim() || null,
    eventType,
    createdAt: parseProviderDate(payload?.dateCreated),
    providerSubscriptionId: String(payment?.subscription || subscription?.id || '').trim() || null,
    providerPaymentId: String(payment?.id || '').trim() || null,
    externalReference: String(payment?.externalReference || subscription?.externalReference || '').trim() || null,
    dueDate: parseProviderDate(payment?.dueDate || subscription?.nextDueDate),
    paymentDate: parseProviderDate(payment?.paymentDate || payment?.confirmedDate || payment?.clientPaymentDate),
    value: payment?.value ?? subscription?.value ?? null,
  };
}

/**
 * Aplica um evento à assinatura atual. Retorna { action, patch, reason }.
 *  - action 'apply'  → gravar `patch` em workspace_subscriptions
 *  - action 'ignore' → evento registrado, sem mudança de estado (com `reason`)
 *
 * Regras de ordem: eventos com dateCreated anterior ao último evento aplicado são ignorados
 * (nunca confia só na ordem de chegada). Duplicatas são barradas antes, pela constraint
 * UNIQUE(provider, event_id) em billing_events.
 */
export function reduceSubscriptionEvent(subscription, event, { now = new Date() } = {}) {
  const current = subscription || {};
  const pending = current?.metadata?.pending_checkout || null;
  const lastAppliedAt = current.last_provider_event_at ? new Date(current.last_provider_event_at) : null;
  const eventAt = event.createdAt || now;

  if (lastAppliedAt && eventAt.getTime() < lastAppliedAt.getTime()) {
    return { action: 'ignore', reason: 'out_of_order' };
  }

  const matchesCurrent = event.providerSubscriptionId && event.providerSubscriptionId === current.provider_subscription_id;
  const matchesPending = event.providerSubscriptionId && event.providerSubscriptionId === pending?.provider_subscription_id;

  if (!matchesCurrent && !matchesPending) {
    return { action: 'ignore', reason: 'unknown_subscription' };
  }

  const tracking = {
    last_provider_event: event.eventType,
    last_provider_event_at: eventAt.toISOString(),
    updated_at: now.toISOString(),
  };

  if (PAID_EVENTS.has(event.eventType)) {
    const periodStart = event.paymentDate || event.dueDate || now;
    const periodEnd = addMonths(event.dueDate || periodStart, 1);
    const metadata = { ...(current.metadata || {}) };
    let planId = current.plan_id;

    if (matchesPending) {
      planId = pending.plan_id;
      delete metadata.pending_checkout;
    }

    return {
      action: 'apply',
      patch: {
        ...tracking,
        plan_id: planId,
        status: 'active',
        provider: 'asaas',
        provider_subscription_id: event.providerSubscriptionId,
        ...(matchesPending && pending?.provider_customer_id ? { provider_customer_id: pending.provider_customer_id } : {}),
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        cancelled_at: null,
        metadata,
      },
    };
  }

  // Eventos de cobrança de um checkout ainda não pago não mexem no plano atual (Free continua).
  if (matchesPending && !matchesCurrent) {
    if (CANCEL_EVENTS.has(event.eventType)) {
      const metadata = { ...(current.metadata || {}) };
      delete metadata.pending_checkout;
      return { action: 'apply', patch: { ...tracking, metadata } };
    }
    return { action: 'ignore', reason: 'pending_checkout_not_paid' };
  }

  if (OVERDUE_EVENTS.has(event.eventType) || REVERSAL_EVENTS.has(event.eventType)) {
    return { action: 'apply', patch: { ...tracking, status: 'past_due' } };
  }

  if (CANCEL_EVENTS.has(event.eventType)) {
    // Mantém o acesso pago até o fim do período já pago; depois o plano efetivo vira Free.
    return {
      action: 'apply',
      patch: { ...tracking, cancel_at_period_end: true, cancelled_at: current.cancelled_at || now.toISOString() },
    };
  }

  return { action: 'ignore', reason: 'no_state_change' };
}

/**
 * Plano efetivo (o que os limites usam), considerando atraso, cancelamento e planos internos.
 * Nunca apaga dados: apenas define qual catálogo de limites vale agora.
 */
export function resolveEffectivePlan({ subscription, plan, freePlan, workspace, now = new Date() }) {
  if (String(workspace?.plan_key || '').toLowerCase() === 'internal') {
    return { plan: { ...(plan || {}), slug: plan?.slug || 'internal', unlimited: true }, reason: 'internal_workspace' };
  }

  if (!subscription || !plan) return { plan: freePlan || null, reason: 'no_subscription' };

  const status = normalizeStatus(subscription.status);
  const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;

  if (status === 'canceled') return { plan: freePlan, reason: 'canceled' };

  if (subscription.cancel_at_period_end && periodEnd && now > periodEnd) {
    return { plan: freePlan, reason: 'canceled_period_ended' };
  }

  if (status === 'past_due' && periodEnd) {
    const graceEnds = new Date(periodEnd.getTime() + GRACE_DAYS_PAST_DUE * 24 * 60 * 60 * 1000);
    if (now > graceEnds) return { plan: freePlan, reason: 'past_due_grace_expired' };
    return { plan, reason: 'past_due_in_grace' };
  }

  return { plan, reason: status };
}
