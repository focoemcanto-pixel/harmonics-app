import { NextResponse } from 'next/server';
import { runPaymentDue2DaysReminder } from '@/lib/automation/payment-due-2-days';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import { cronDeniedResponse, verifyCronRequest } from '@/lib/api/server-secrets';

// Falha fechada: antes, sem CRON_SECRET a rota ficava pública e aceitava ?key= na URL.
async function assertAdminIfNotCron(request) {
  if (verifyCronRequest(request).ok) return { ok: true };

  const supabase = getSupabaseAdmin();
  const auth = await requireAdmin({
    supabase,
    request,
    logPrefix: '[PAYMENT_REMINDERS_CRON]',
  });

  return auth;
}

export async function GET(request) {
  const cronAuth = verifyCronRequest(request);
  if (!cronAuth.ok) return cronDeniedResponse(cronAuth, '[PAYMENT_REMINDERS_CRON]');

  try {
    const result = await runPaymentDue2DaysReminder();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[GET /api/cron/payment-reminders] erro:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await assertAdminIfNotCron(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const forcedTargetDate = body?.targetDate || null;
    const result = await runPaymentDue2DaysReminder({ forcedTargetDate });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[POST /api/cron/payment-reminders] erro:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Erro interno' }, { status: 500 });
  }
}
