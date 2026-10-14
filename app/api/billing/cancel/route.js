import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api-observability';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { loadWorkspaceBilling } from '@/lib/billing/plan-limits';
import { cancelSubscription } from '@/lib/billing/asaas-client';

export const dynamic = 'force-dynamic';

// Cancela no fim do período já pago (o acesso pago continua até current_period_end).
async function handlePOST(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[POST /api/billing/cancel]' });
  if (!guard.ok) return guard.response;

  const supabase = guard.supabase;
  const workspaceId = guard.auth.workspaceId;

  try {
    const { subscription } = await loadWorkspaceBilling({ supabase, workspaceId });
    if (!subscription?.id) return NextResponse.json({ ok: false, error: 'Assinatura não encontrada.' }, { status: 404 });

    const pending = subscription.metadata?.pending_checkout;
    const metadata = { ...(subscription.metadata || {}) };
    if (pending?.provider_subscription_id) {
      await cancelSubscription(pending.provider_subscription_id).catch(() => null);
      delete metadata.pending_checkout;
    }

    if (!subscription.provider_subscription_id) {
      await supabase.from('workspace_subscriptions').update({ metadata, updated_at: new Date().toISOString() }).eq('id', subscription.id);
      return NextResponse.json({ ok: true, canceledPendingCheckout: Boolean(pending) });
    }

    if (subscription.cancel_at_period_end) return NextResponse.json({ ok: true, alreadyCanceled: true });

    await cancelSubscription(subscription.provider_subscription_id);
    const { error } = await supabase
      .from('workspace_subscriptions')
      .update({ cancel_at_period_end: true, cancelled_at: new Date().toISOString(), metadata, updated_at: new Date().toISOString() })
      .eq('id', subscription.id);
    if (error) throw error;

    return NextResponse.json({ ok: true, cancelAtPeriodEnd: true, accessUntil: subscription.current_period_end || null });
  } catch (error) {
    console.error('[POST /api/billing/cancel][ERROR]', { workspaceId, code: error?.code, message: error?.message });
    return NextResponse.json({ ok: false, error: 'Não foi possível cancelar agora. Tente novamente.' }, { status: error?.statusCode || 500 });
  }
}

export const POST = withApiObservability(handlePOST, { route: '/api/billing/cancel' });
