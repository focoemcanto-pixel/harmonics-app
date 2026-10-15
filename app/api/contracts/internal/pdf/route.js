import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { generateAndSaveInternalContractPdf } from '@/lib/contracts/internalPdfFlow';
import { assertRowInWorkspace, guardInternalOrWorkspaceAdmin } from '@/lib/api/route-guards';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function asString(value) {
  return String(value ?? '').trim();
}

function errorResponse(code, message, status) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function resolveStatus(error) {
  if (error?.code === 'MISSING_HTML') return 400;
  if (error?.code === 'MISSING_CONTRACT') return 404;
  if (error?.code === 'SERVICE_UNAUTHORIZED') return 401;
  if (error?.code === 'MISSING_SERVICE_URL') return 500;
  if (error?.code === 'MISSING_BUCKET') return 500;
  if (error?.code === 'DB_UPDATE_ERROR') return 500;
  if (error?.code === 'STORAGE_ERROR') return 500;
  if (error?.code === 'SERVICE_ERROR') return 502;
  return 500;
}

export async function POST(request) {
  const guard = await guardInternalOrWorkspaceAdmin(request, { logPrefix: '[POST /api/contracts/internal/pdf]' });
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json().catch(() => null);
    const contractId = asString(body?.contractId) || null;
    const precontractId = asString(body?.precontractId) || null;
    const html = body?.html || body?.signedHtml || '';

    const supabase = getSupabaseAdmin();

    if (!guard.internal) {
      const workspaceId = guard.auth.workspaceId;
      if (!contractId && !precontractId) {
        return errorResponse('MISSING_CONTRACT', 'contractId ou precontractId é obrigatório.', 400);
      }
      if (contractId) {
        const check = await assertRowInWorkspace({ supabase, table: 'contracts', id: contractId, workspaceId });
        if (!check.ok) return check.response;
      }
      if (precontractId) {
        const check = await assertRowInWorkspace({ supabase, table: 'precontracts', id: precontractId, workspaceId });
        if (!check.ok) return check.response;
      }
    }
    const result = await generateAndSaveInternalContractPdf({
      supabase,
      contractId,
      precontractId,
      html,
    });

    return NextResponse.json({
      ok: true,
      mode: 'internal',
      contractId: result.contractId || null,
      precontractId: result.precontractId,
      pdfUrl: result.pdfUrl,
      storage: {
        bucket: result.bucket,
        path: result.path,
      },
    });
  } catch (error) {
    const code = error?.code || 'SERVICE_ERROR';
    const message = asString(error?.message) || 'Não foi possível gerar o PDF do contrato neste momento.';
    const status = resolveStatus(error);
    return errorResponse(code, message, status);
  }
}
