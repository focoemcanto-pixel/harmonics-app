import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import { deletePaymentsByIds } from '@/lib/payments/delete-payments';

function normalizePayloadIds(body = {}) {
  return [
    ...(Array.isArray(body?.paymentIds) ? body.paymentIds : []),
    ...(Array.isArray(body?.payment_ids) ? body.payment_ids : []),
    ...(Array.isArray(body?.ids) ? body.ids : []),
  ];
}

function uniqIds(list = []) {
  return Array.from(new Set(list.map((id) => String(id || '').trim()).filter(Boolean)));
}

async function filterWorkspacePaymentIds({ supabase, paymentIds, workspaceId }) {
  const ids = uniqIds(paymentIds);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('payments')
    .select('id')
    .eq('workspace_id', workspaceId)
    .in('id', ids);

  if (error) throw error;
  return uniqIds((data || []).map((row) => row.id));
}

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      moduleKey: 'pagamentos',
      actionKey: 'write',
      logPrefix: '[PAYMENT_BULK_DELETE_API]',
    });

    if (!auth.ok) {
      return NextResponse.json(auth, { status: auth.status || 401 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedPaymentIds = uniqIds(normalizePayloadIds(body));

    console.info('[PAYMENT_BULK_DELETE_API][DELETE][IDS]', {
      requestedPaymentIds,
      workspaceId: auth.workspaceId,
    });

    if (requestedPaymentIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          affected: 0,
          message: 'Selecione ao menos um pagamento.',
        },
        { status: 400 }
      );
    }

    const paymentIds = await filterWorkspacePaymentIds({
      supabase,
      paymentIds: requestedPaymentIds,
      workspaceId: auth.workspaceId,
    });

    if (paymentIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          ok: false,
          affected: 0,
          message: 'Nenhum pagamento válido encontrado neste workspace.',
        },
        { status: 404 }
      );
    }

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
