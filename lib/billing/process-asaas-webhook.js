import { describeAsaasEvent, reduceSubscriptionEvent } from '@/lib/billing/subscription-state';

const PROVIDER = 'asaas';

function timingSafeEqualString(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

// O Asaas envia o token configurado no painel no header `asaas-access-token`.
// Sem segredo configurado o webhook falha fechado.
export function authenticateAsaasWebhook(headers, secret = process.env.ASAAS_WEBHOOK_SECRET) {
  const expected = String(secret || '').trim();
  if (!expected) return { ok: false, status: 503, error: 'Webhook de billing não configurado.' };
  const received = String(headers?.get?.('asaas-access-token') || '').trim();
  if (!timingSafeEqualString(received, expected)) return { ok: false, status: 401, error: 'Token do webhook inválido.' };
  return { ok: true };
}

async function findSubscription(supabase, event) {
  if (event.providerSubscriptionId) {
    const { data: byCurrent } = await supabase
      .from('workspace_subscriptions')
      .select('*')
      .eq('provider_subscription_id', event.providerSubscriptionId)
      .maybeSingle();
    if (byCurrent?.id) return byCurrent;
  }

  // Checkout pendente: a assinatura do provedor ainda está só em metadata.pending_checkout.
  // externalReference = workspace_id (definido por nós ao criar a assinatura no Asaas).
  if (event.externalReference) {
    const { data: byWorkspace } = await supabase
      .from('workspace_subscriptions')
      .select('*')
      .eq('workspace_id', event.externalReference)
      .in('status', ['active', 'trialing', 'past_due', 'paused'])
      .maybeSingle();
    if (byWorkspace?.id) return byWorkspace;

    // Reassinatura de workspace cancelado: o checkout pendente está na linha mais recente.
    const { data: latest } = await supabase
      .from('workspace_subscriptions')
      .select('*')
      .eq('workspace_id', event.externalReference)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest?.id) return latest;
  }

  return null;
}

/**
 * Processa um webhook Asaas já autenticado. Retorna { httpStatus, body }.
 * - Duplicata (mesmo event id): 200 sem reprocessar (constraint UNIQUE(provider, event_id)).
 * - Fora de ordem / desconhecido: 200, registrado como 'ignored' com motivo.
 * - Falha de banco: 500 (o Asaas tenta de novo; o registro 'received' permite reprocessar).
 */
export async function processAsaasWebhook({ supabase, payload, now = new Date() }) {
  const event = describeAsaasEvent(payload);
  if (!event.eventId || !event.eventType) {
    return { httpStatus: 400, body: { ok: false, error: 'Payload sem id/event.' } };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('billing_events')
    .insert({
      provider: PROVIDER,
      event_id: event.eventId,
      event_type: event.eventType,
      event_created_at: event.createdAt ? event.createdAt.toISOString() : null,
      provider_subscription_id: event.providerSubscriptionId,
      provider_payment_id: event.providerPaymentId,
      payload,
      status: 'received',
    })
    .select('id, status')
    .single();

  if (insertError) {
    if (String(insertError.code) === '23505') {
      const { data: existing } = await supabase
        .from('billing_events')
        .select('id, status')
        .eq('provider', PROVIDER)
        .eq('event_id', event.eventId)
        .maybeSingle();
      // Já processado (ou ignorado): idempotente. Se ficou 'received'/'failed', reprocessa.
      if (existing && !['received', 'failed'].includes(existing.status)) {
        return { httpStatus: 200, body: { ok: true, duplicate: true } };
      }
      return applyEvent({ supabase, event, billingEventId: existing?.id, now });
    }
    return { httpStatus: 500, body: { ok: false, error: 'Falha ao registrar evento.' } };
  }

  return applyEvent({ supabase, event, billingEventId: inserted?.id, now });
}

async function finishEvent(supabase, billingEventId, fields) {
  if (!billingEventId) return;
  await supabase
    .from('billing_events')
    .update({ ...fields, processed_at: new Date().toISOString() })
    .eq('id', billingEventId);
}

async function applyEvent({ supabase, event, billingEventId, now }) {
  try {
    const subscription = await findSubscription(supabase, event);
    if (!subscription) {
      await finishEvent(supabase, billingEventId, { status: 'ignored', error: 'unknown_subscription' });
      return { httpStatus: 200, body: { ok: true, ignored: 'unknown_subscription' } };
    }

    const result = reduceSubscriptionEvent(subscription, event, { now });

    if (result.action === 'ignore') {
      await finishEvent(supabase, billingEventId, { status: 'ignored', error: result.reason, workspace_id: subscription.workspace_id });
      return { httpStatus: 200, body: { ok: true, ignored: result.reason } };
    }

    const { error: updateError } = await supabase
      .from('workspace_subscriptions')
      .update(result.patch)
      .eq('id', subscription.id);

    if (updateError) {
      await finishEvent(supabase, billingEventId, { status: 'failed', error: updateError.message, workspace_id: subscription.workspace_id });
      return { httpStatus: 500, body: { ok: false, error: 'Falha ao atualizar assinatura.' } };
    }

    await finishEvent(supabase, billingEventId, { status: 'processed', error: null, workspace_id: subscription.workspace_id });
    return { httpStatus: 200, body: { ok: true, applied: event.eventType, status: result.patch.status || subscription.status } };
  } catch (error) {
    await finishEvent(supabase, billingEventId, { status: 'failed', error: String(error?.message || error) });
    return { httpStatus: 500, body: { ok: false, error: 'Falha ao processar evento.' } };
  }
}
