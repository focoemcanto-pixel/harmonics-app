import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import { getCurrentWorkspace } from '@/lib/workspaces/get-current-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_LIST_LIMIT = 100;

const PRECONTRACTS_SELECT_FIELDS =
  'id, workspace_id, created_at, event_id, client_name, event_type, event_date, location_name, client_phone, status, notes, public_token, custom_contract_enabled, contract_mode';
const CONTRACTS_SELECT_FIELDS =
  'id, workspace_id, created_at, precontract_id, event_id, status, signed_at, pdf_url, doc_url, public_token, raw_payload';

function normalizeListLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.max(Math.trunc(parsed), 1), 300);
}

export async function GET(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      logPrefix: '[CONTRACTS_API][GET]',
      allowedRoles: ['owner', 'admin', 'financeiro', 'operacional', 'viewer'],
    });

    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.error }, { status: auth.status || 401 });
    }

    const workspaceContext = await getCurrentWorkspace({ supabase, request });
    const workspaceId = workspaceContext?.workspaceId || auth.workspaceId;
    const { searchParams } = new URL(request.url);
    const limit = normalizeListLimit(searchParams.get('limit'));

    const [{ data: precontracts, error: preErr }, { data: contracts, error: conErr }] =
      await Promise.all([
        supabase
          .from('precontracts')
          .select(PRECONTRACTS_SELECT_FIELDS)
          .eq('workspace_id', workspaceId)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(limit),

        supabase
          .from('contracts')
          .select(CONTRACTS_SELECT_FIELDS)
          .eq('workspace_id', workspaceId)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(limit),
      ]);

    if (preErr) throw preErr;
    if (conErr) throw conErr;

    return NextResponse.json({
      ok: true,
      precontracts: precontracts || [],
      contracts: contracts || [],
      workspaceId,
    });
  } catch (error) {
    console.error('[CONTRACTS_API][GET][ERROR]', {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });

    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'Erro inesperado ao carregar contratos.',
      },
      { status: 500 }
    );
  }
}
