import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import { deletePaymentsByIds } from '@/lib/payments/delete-payments';

export async function DELETE(request, { params }) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireAdmin({ supabase, request, logPrefix: '[PAYMENT_DELETE_ONE_API]' });
    if (!auth.ok) return NextResponse.json(auth, { status: auth.status || 401 });

    const paymentId = params?.id;

    if (!paymentId) {
      return NextResponse.json(
        { success: false, ok: false, affected: 0, message: 'paymentId é obrigatório.' },
        { status: 400 }
      );
    }

    console.info('[PAYMENT_DELETE_ONE_API][DELETE][IDS]', { paymentIds: [paymentId] });

    const result = await deletePaymentsByIds({
      supabase,
      paymentIds: [paymentId],
      logPrefix: '[PAYMENT_DELETE_ONE_API]',
    });

    console.info('[PAYMENT_DELETE_ONE_API][DELETE][RESULT]', result);

    if (!result.success || Number(result.affected || 0) === 0) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[PAYMENT_DELETE_ONE_API][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      {
        success: false,
        ok: false,
        affected: 0,
        message: error?.message || 'Erro ao excluir pagamento.',
      },
      { status: 500 }
    );
  }
}
