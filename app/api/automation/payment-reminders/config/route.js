import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api/require-admin';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  getPaymentDue2DaysConfig,
  updatePaymentDue2DaysConfig,
  DEFAULT_PAYMENT_DUE_2_DAYS_MESSAGE,
} from '@/lib/automation/payment-due-2-days';

async function requireConfigAdmin(request, method) {
  const supabase = getSupabaseAdmin();
  const auth = await requireAdmin({
    supabase,
    request,
    logPrefix: `[PAYMENT_REMINDERS_CONFIG][${method}]`,
  });
  return auth;
}

export async function GET(request) {
  const auth = await requireConfigAdmin(request, 'GET');
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
  }

  try {
    const config = await getPaymentDue2DaysConfig();
    return NextResponse.json({ ok: true, ...config, defaultMessage: DEFAULT_PAYMENT_DUE_2_DAYS_MESSAGE });
  } catch (error) {
    console.error('[GET /api/automation/payment-reminders/config] erro:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const auth = await requireConfigAdmin(request, 'PATCH');
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const updated = await updatePaymentDue2DaysConfig({
      isEnabled: typeof body?.isEnabled === 'boolean' ? body.isEnabled : undefined,
      message: body?.message,
    });

    return NextResponse.json({ ok: true, ...updated });
  } catch (error) {
    console.error('[PATCH /api/automation/payment-reminders/config] erro:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Erro interno' }, { status: 500 });
  }
}
