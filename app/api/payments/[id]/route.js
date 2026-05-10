import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import { deletePaymentsByIds } from '@/lib/payments/delete-payments';

async function paymentBelongsToWorkspace({ supabase, paymentId, workspaceId }) {
  const { data, error } = await supabase
    .from('payments')
    .select('id')
    .eq('id', paymentId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
}

export async function DELETE(request, context) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      moduleKey: 'pagamentos',
      actionKey: 'write',
      logPrefix: '[PAYMENT_DELETE_ONE_API]',
    });

    if (!auth.ok) {
      return NextResponse.json(auth, { status: auth.status || 401 });
    }

    const resolvedParams = await context?.params;
    const paymentId = String(resolvedParams?.id || '').trim();

    if (!paymentId) {
      return NextResponse.json(
        { success: false, ok: false, affected: 0, message: 'paymentId é obrigatório.' },
        { status: 400 }
      );
    }

    const canDeletePayment = await paymentBelongsToWorkspace({
      supabase,
      paymentId,
      workspaceId: auth.workspaceId,
    });

    if (!canDeletePayment) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          affected: 0,
          message: 'Pagamento não encontrado neste workspace.',
        },
        { status: 404 }
      );
    }

    console.info('[PAYMENT_DELETE_ONE_API][DELETE][IDS]', {
      paymentIds: [paymentId],
      workspaceId: auth.workspaceId,
    });

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
