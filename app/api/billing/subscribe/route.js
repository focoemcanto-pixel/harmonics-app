import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api-observability';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { loadLatestSubscriptionRow, loadWorkspaceBilling } from '@/lib/billing/plan-limits';
import { normalizeStatus } from '@/lib/billing/subscription-state';
import { createCustomer, createSubscription, listSubscriptionPayments, updateSubscription } from '@/lib/billing/asaas-client';

export const dynamic = 'force-dynamic';

const CHECKOUT_REUSE_WINDOW_MS = 24 * 60 * 60 * 1000;

function onlyDigits(value) {
  return String(value || '').replace(/\D+/g, '');
}

function fail(status, error, code = null) {
  return NextResponse.json({ ok: false, error, code }, { status });
}

async function handlePOST(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[POST /api/billing/subscribe]' });
  if (!guard.ok) return guard.response;

  const supabase = guard.supabase;
  const workspaceId = guard.auth.workspaceId;
  const body = await request.json().catch(() => ({}));
  const planSlug = String(body?.planSlug || '').trim();

  try {
    const { data: plan } = await supabase
      .from('workspace_plans')
      .select('id, slug, name, monthly_price, is_public')
      .eq('slug', planSlug)
      .eq('is_public', true)
      .maybeSingle();

    if (!plan?.id) return fail(404, 'Plano inválido.');
    if (!(Number(plan.monthly_price) > 0)) return fail(400, 'Este plano não exige pagamento.');

    const billing = await loadWorkspaceBilling({ supabase, workspaceId });
    if (billing.effectiveReason === 'internal_workspace') return fail(409, 'Este workspace usa um plano interno.');

    // Sem assinatura ativa (ex.: cancelada antes): reaproveita a linha mais recente para reassinar.
    const subscription = billing.subscription || (await loadLatestSubscriptionRow({ supabase, workspaceId }));
    if (!subscription?.id) return fail(409, 'Assinatura do workspace não encontrada.');

    const pending = subscription.metadata?.pending_checkout;
    const pendingIsFresh = pending?.created_at && Date.now() - new Date(pending.created_at).getTime() < CHECKOUT_REUSE_WINDOW_MS;
    if (pending?.plan_id === plan.id && pendingIsFresh && pending.invoice_url) {
      // Idempotência: clique duplo / volta pelo navegador reaproveita a mesma cobrança.
      return NextResponse.json({ ok: true, reused: true, checkoutUrl: pending.invoice_url });
    }

    const hasPaidSubscription = Boolean(subscription.provider_subscription_id) && !subscription.cancel_at_period_end && normalizeStatus(subscription.status) !== 'canceled';
    if (hasPaidSubscription) {
      if (subscription.plan_id === plan.id) return fail(409, 'Você já está neste plano.');
      // Troca de plano: ajusta o valor da assinatura existente; vale a partir de agora.
      await updateSubscription(subscription.provider_subscription_id, {
        value: Number(plan.monthly_price),
        description: `Harmonics ${plan.name}`,
        updatePendingPayments: true,
      });
      const { error } = await supabase
        .from('workspace_subscriptions')
        .update({ plan_id: plan.id, updated_at: new Date().toISOString() })
        .eq('id', subscription.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, changed: true });
    }

    let customerId = subscription.provider_customer_id || null;
    if (!customerId) {
      const cpfCnpj = onlyDigits(body?.cpfCnpj);
      if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
        return fail(400, 'Informe um CPF ou CNPJ válido para emitir a cobrança.', 'CPF_CNPJ_REQUIRED');
      }
      const customer = await createCustomer({
        name: String(body?.name || guard.auth.workspace?.name || guard.auth.email || 'Cliente Harmonics').slice(0, 120),
        email: guard.auth.email || undefined,
        cpfCnpj,
        mobilePhone: onlyDigits(body?.phone) || undefined,
        externalReference: workspaceId,
      });
      customerId = customer.id;
    }

    const today = new Date().toISOString().slice(0, 10);
    const providerSubscription = await createSubscription({
      customer: customerId,
      billingType: 'UNDEFINED',
      value: Number(plan.monthly_price),
      nextDueDate: today,
      cycle: 'MONTHLY',
      description: `Harmonics ${plan.name}`,
      externalReference: workspaceId,
    });

    const payments = await listSubscriptionPayments(providerSubscription.id).catch(() => null);
    const invoiceUrl = payments?.data?.[0]?.invoiceUrl || null;

    // O plano atual (ex.: Free) continua valendo até o webhook confirmar o pagamento.
    const { error: updateError } = await supabase
      .from('workspace_subscriptions')
      .update({
        provider_customer_id: customerId,
        metadata: {
          ...(subscription.metadata || {}),
          pending_checkout: {
            plan_id: plan.id,
            provider_subscription_id: providerSubscription.id,
            provider_customer_id: customerId,
            invoice_url: invoiceUrl,
            created_at: new Date().toISOString(),
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true, checkoutUrl: invoiceUrl });
  } catch (error) {
    console.error('[POST /api/billing/subscribe][ERROR]', { workspaceId, code: error?.code, message: error?.message });
    return fail(error?.statusCode || 500, error?.code === 'ASAAS_NOT_CONFIGURED' ? error.message : 'Não foi possível iniciar a assinatura.', error?.code || null);
  }
}

export const POST = withApiObservability(handlePOST, { route: '/api/billing/subscribe' });
