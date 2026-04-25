import { NextResponse } from 'next/server';
import { runPaymentDue2DaysReminder } from '@/lib/automation/payment-due-2-days';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';

function getCronTokenFromRequest(request) {
  const authHeader = request.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const query = new URL(request.url).searchParams;
  const queryToken = query.get('key') || '';
  return bearer || queryToken;
}

function isCronAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return getCronTokenFromRequest(request) === cronSecret;
}

async function assertAdminIfNotCron(request) {
  if (isCronAuthorized(request)) return { ok: true };

  const supabase = getSupabaseAdmin();
  const auth = await requireAdmin({
    supabase,
    request,
    logPrefix: '[PAYMENT_REMINDERS_CRON]',
  });

  return auth;
}

export async function GET(request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

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
