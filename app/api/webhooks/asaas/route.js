import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const STATUS_MAP = {
  ACTIVE: 'active',
  OVERDUE: 'past_due',
  CANCELED: 'cancelled',
  PENDING: 'trialing',
  EXPIRED: 'expired',
};

export async function POST(request) {
  const secret = process.env.ASAAS_WEBHOOK_SECRET;
  const signature = request.headers.get('asaas-access-token') || request.headers.get('x-asaas-signature');
  if (secret && signature !== secret) {
    return NextResponse.json({ error: 'Assinatura webhook inválida.' }, { status: 401 });
  }

  const payload = await request.json();
  const eventType = String(payload?.event || 'unknown');
  const subId = payload?.payment?.subscription || payload?.subscription?.id;

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from('billing_events')
    .select('id')
    .eq('provider', 'asaas')
    .eq('event_type', eventType)
    .eq('payload->>id', String(payload?.id || ''))
    .maybeSingle();

  if (existing?.id) return NextResponse.json({ ok: true, duplicate: true });

  await admin.from('billing_events').insert({
    provider: 'asaas',
    event_type: eventType,
    payload,
    processed: false,
  });

  if (subId) {
    const mappedStatus = STATUS_MAP[String(payload?.subscription?.status || payload?.payment?.status || '').toUpperCase()] || null;
    const patch = {
      last_webhook_event: eventType,
      asaas_subscription_id: subId,
      asaas_payment_id: payload?.payment?.id || null,
      next_billing_at: payload?.payment?.dueDate || null,
      current_period_end: payload?.payment?.dueDate || null,
      canceled_at: eventType.includes('CANCELED') ? new Date().toISOString() : null,
    };
    if (mappedStatus) patch.status = mappedStatus;

    await admin.from('workspace_subscriptions').update(patch).eq('asaas_subscription_id', subId);
  }

  await admin.from('billing_events').update({ processed: true }).eq('provider', 'asaas').eq('event_type', eventType).order('created_at', { ascending: false }).limit(1);

  return NextResponse.json({ ok: true });
}
