import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api-observability';
import { guardWorkspaceMember } from '@/lib/api/route-guards';
import { loadWorkspaceBilling } from '@/lib/billing/plan-limits';
import { isAsaasConfigured } from '@/lib/billing/asaas-client';

export const dynamic = 'force-dynamic';

async function handleGET(request) {
  const guard = await guardWorkspaceMember(request, { logPrefix: '[GET /api/billing/summary]' });
  if (!guard.ok) return guard.response;

  const supabase = guard.supabase;
  const workspaceId = guard.auth.workspaceId;
  const billing = await loadWorkspaceBilling({ supabase, workspaceId });

  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  // Mesma janela da cota de WhatsApp em checkWorkspaceLimit (início do período da assinatura ou do mês).
  const whatsappSince = billing.subscription?.current_period_start || monthStart;
  const [{ count: eventsThisMonth }, { count: activeMembers }, { data: history }, { data: whatsappUsage }] = await Promise.all([
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).gte('created_at', monthStart),
    supabase.from('workspace_members').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'active'),
    supabase
      .from('billing_events')
      .select('event_type, event_created_at, received_at, status, payload->payment->>value, payload->payment->>billingType, payload->payment->>invoiceUrl')
      .eq('workspace_id', workspaceId)
      .like('event_type', 'PAYMENT_%')
      .order('received_at', { ascending: false })
      .limit(12),
    supabase
      .from('usage_events')
      .select('quantity')
      .eq('workspace_id', workspaceId)
      .eq('event_type', 'whatsapp_message_sent')
      .gte('occurred_at', whatsappSince),
  ]);
  const whatsappMessages = (whatsappUsage || []).reduce((total, row) => total + Number(row?.quantity || 0), 0);

  const subscription = billing.subscription || null;
  const pending = subscription?.metadata?.pending_checkout || null;

  return NextResponse.json({
    ok: true,
    canManage: Boolean(guard.auth.canAdminWorkspace),
    paymentsConfigured: isAsaasConfigured(),
    internal: billing.effectiveReason === 'internal_workspace',
    subscription: subscription
      ? {
          status: subscription.status,
          plan: subscription.plan ? { slug: subscription.plan.slug, name: subscription.plan.name, monthly_price: subscription.plan.monthly_price } : null,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end,
          cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
          provider: subscription.provider || null,
          pending_checkout: pending ? { plan_id: pending.plan_id, invoice_url: pending.invoice_url || null, created_at: pending.created_at || null } : null,
        }
      : null,
    effectivePlan: billing.effectivePlan
      ? { slug: billing.effectivePlan.slug, name: billing.effectivePlan.name, max_events_per_month: billing.effectivePlan.max_events_per_month ?? null, max_members: billing.effectivePlan.max_members ?? null, can_use_whatsapp: Boolean(billing.effectivePlan.can_use_whatsapp), max_whatsapp_messages: billing.effectivePlan.max_whatsapp_messages ?? null, unlimited: Boolean(billing.effectivePlan.unlimited) }
      : null,
    effectiveReason: billing.effectiveReason,
    usage: { eventsThisMonth: Number(eventsThisMonth || 0), activeMembers: Number(activeMembers || 0), whatsappMessages },
    history: history || [],
  });
}

export const GET = withApiObservability(handleGET, { route: '/api/billing/summary' });
