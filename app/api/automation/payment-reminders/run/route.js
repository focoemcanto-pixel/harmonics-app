import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import { runPaymentDue2DaysReminder } from '@/lib/automation/payment-due-2-days';

export async function POST(request) {
  const supabase = getSupabaseAdmin();
  const auth = await requireAdmin({
    supabase,
    request,
    logPrefix: '[PAYMENT_REMINDERS_RUN]',
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = await runPaymentDue2DaysReminder({
      forcedTargetDate: body?.targetDate || null,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[POST /api/automation/payment-reminders/run] erro:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Erro interno' }, { status: 500 });
  }
}
