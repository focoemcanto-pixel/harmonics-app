import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import { deleteContractsCascade } from '@/lib/contracts/delete-contracts-cascade';

function uniqIds(list = []) {
  return Array.from(new Set(list.map((id) => String(id || '').trim()).filter(Boolean)));
}

async function filterWorkspacePrecontractIds({ supabase, precontractIds, workspaceId }) {
  const ids = uniqIds(precontractIds);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('precontracts')
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
      moduleKey: 'contracts',
      actionKey: 'write',
      logPrefix: '[CONTRACT_DELETE_MANY]',
    });

    if (!auth.ok) {
      return NextResponse.json(auth, { status: auth.status || 401 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedPrecontractIds = uniqIds(
      Array.isArray(body?.precontractIds) ? body.precontractIds : []
    );

    console.info('[CONTRACT_DELETE_MANY][DELETE][TABLE]', {
      table: 'precontracts, contracts',
    });

    console.info('[CONTRACT_DELETE_MANY][DELETE][IDS]', {
      requestedPrecontractIds,
      workspaceId: auth.workspaceId,
    });

    if (requestedPrecontractIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Selecione ao menos um contrato.' },
        { status: 400 }
      );
    }

    const precontractIds = await filterWorkspacePrecontractIds({
      supabase,
      precontractIds: requestedPrecontractIds,
      workspaceId: auth.workspaceId,
    });

    if (precontractIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Nenhum contrato válido encontrado neste workspace.' },
        { status: 404 }
      );
    }

    const result = await deleteContractsCascade({
      supabase,
      precontractIds,
    });

    console.info('[CONTRACT_DELETE_MANY][DELETE][RESULT]', {
      requested: result.requested,
      success: result.success.length,
      failed: result.failed.length,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      success: true,
      deleted: result.success.length,
      failedCount: result.failed.length,
    });
  } catch (error) {
    console.error('[CONTRACT_DELETE_MANY][DELETE][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Erro ao excluir contratos.',
      },
      { status: 500 }
    );
  }
}
