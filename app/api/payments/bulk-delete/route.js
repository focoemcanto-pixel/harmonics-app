import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import { deletePaymentsByIds } from '@/lib/payments/delete-payments';

function normalizePayloadIds(body = {}) {
  return [
    ...(Array.isArray(body?.paymentIds) ? body.paymentIds : []),
    ...(Array.isArray(body?.payment_ids) ? body.payment_ids : []),
    ...(Array.isArray(body?.ids) ? body.ids : []),
  ];
}

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireAdmin({ supabase, request, logPrefix: '[PAYMENT_BULK_DELETE_API]' });
    if (!auth.ok) return NextResponse.json(auth, { status: auth.status || 401 });

    const body = await request.json().catch(() => ({}));
    const paymentIds = normalizePayloadIds(body);

    console.info('[PAYMENT_BULK_DELETE_API][DELETE][IDS]', { paymentIds });

    const result = await deletePaymentsByIds({
      supabase,
      paymentIds,
      logPrefix: '[PAYMENT_BULK_DELETE_API]',
    });

    console.info('[PAYMENT_BULK_DELETE_API][DELETE][RESULT]', result);

    if (!result.success || Number(result.affected || 0) === 0) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[PAYMENT_BULK_DELETE_API][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      {
        success: false,
        ok: false,
        affected: 0,
        message: error?.message || 'Erro ao excluir pagamentos.',
      },
      { status: 500 }
    );
  }
}
