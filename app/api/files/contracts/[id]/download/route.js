import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import { safeLogFileAccess } from '@/lib/files/log-file-access';
import { trackUsageEvent } from '@/lib/usage/track-usage-event';
import { resolveContractStoragePath } from '@/lib/contracts/contract-storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function sanitizeFileName(value, fallback = 'contrato.pdf') {
  const clean = String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120);

  return clean || fallback;
}

function resolveContentType(blob, path) {
  const fromBlob = blob?.type && blob.type !== 'application/octet-stream' ? blob.type : '';
  if (fromBlob) return fromBlob;
  const lower = String(path || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

export async function GET(request, context) {
  const supabase = getSupabaseAdmin();
  let auditContext = null;

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      moduleKey: 'contracts',
      actionKey: 'read',
      logPrefix: '[CONTRACT_DOWNLOAD_PROXY]',
    });

    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error || 'Acesso não autorizado.' }, { status: auth.status || 401 });
    }

    const resolvedParams = await context?.params;
    const contractId = String(resolvedParams?.id || '').trim();

    if (!contractId) {
      return NextResponse.json({ ok: false, error: 'ID do contrato é obrigatório.' }, { status: 400 });
    }

    const { data: contract, error } = await supabase
      .from('contracts')
      .select('id, workspace_id, pdf_url, client_name, precontract_id')
      .eq('id', contractId)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    if (error) throw error;

    if (!contract?.id) {
      return NextResponse.json({ ok: false, error: 'Contrato não encontrado neste workspace.' }, { status: 404 });
    }

    if (!contract.pdf_url) {
      return NextResponse.json({ ok: false, error: 'Contrato sem PDF disponível.' }, { status: 404 });
    }

    const storage = resolveContractStoragePath(contract.pdf_url);
    auditContext = { auth, contractId, storage };

    if (!storage.bucket || !storage.path) {
      await safeLogFileAccess({
        supabase,
        request,
        workspaceId: auth.workspaceId,
        entityType: 'contract',
        entityId: contractId,
        bucketId: storage.bucket || null,
        objectPath: storage.path || null,
        accessType: 'download_proxy',
        actorUserId: auth.userId || null,
        actorRole: auth.role || null,
        status: 'failed',
        errorMessage: 'PDF do contrato não possui referência de storage válida.',
      });

      return NextResponse.json({ ok: false, error: 'PDF do contrato não possui referência de storage válida.' }, { status: 422 });
    }

    const storageWorkspaceId = storage.workspaceId ? String(storage.workspaceId) : '';
    if (storageWorkspaceId && storageWorkspaceId !== String(auth.workspaceId)) {
      await safeLogFileAccess({
        supabase,
        request,
        workspaceId: auth.workspaceId,
        entityType: 'contract',
        entityId: contractId,
        bucketId: storage.bucket,
        objectPath: storage.path,
        accessType: 'download_proxy',
        actorUserId: auth.userId || null,
        actorRole: auth.role || null,
        status: 'failed',
        errorMessage: 'PDF do contrato pertence a outro workspace.',
        metadata: { storageWorkspaceId },
      });

      return NextResponse.json({ ok: false, error: 'PDF do contrato pertence a outro workspace.' }, { status: 403 });
    }

    const { data: blob, error: downloadError } = await supabase.storage
      .from(storage.bucket)
      .download(storage.path);

    if (downloadError || !blob) {
      throw new Error(downloadError?.message || 'Não foi possível baixar o PDF do contrato.');
    }

    await safeLogFileAccess({
      supabase,
      request,
      workspaceId: auth.workspaceId,
      entityType: 'contract',
      entityId: contractId,
      bucketId: storage.bucket,
      objectPath: storage.path,
      accessType: 'download_proxy',
      actorUserId: auth.userId || null,
      actorRole: auth.role || null,
      status: 'success',
      metadata: { proxied: true },
    });

    await trackUsageEvent({
      supabase,
      workspaceId: auth.workspaceId,
      eventType: 'file_downloaded',
      quantity: 1,
      unit: 'count',
      entityType: 'contract',
      entityId: contractId,
      source: 'contract_download_proxy',
      metadata: {
        bucket: storage.bucket,
        path: storage.path,
        contentType: resolveContentType(blob, storage.path),
      },
    });

    const contentType = resolveContentType(blob, storage.path);
    const fileName = sanitizeFileName(`contrato-${contractId}.pdf`);

    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[CONTRACT_DOWNLOAD_PROXY][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    if (auditContext?.auth?.workspaceId) {
      await safeLogFileAccess({
        supabase,
        request,
        workspaceId: auditContext.auth.workspaceId,
        entityType: 'contract',
        entityId: auditContext.contractId || null,
        bucketId: auditContext.storage?.bucket || null,
        objectPath: auditContext.storage?.path || null,
        accessType: 'download_proxy',
        actorUserId: auditContext.auth.userId || null,
        actorRole: auditContext.auth.role || null,
        status: 'failed',
        errorMessage: error?.message || 'Erro no proxy de download do contrato.',
      });
    }

    return NextResponse.json({ ok: false, error: error?.message || 'Erro ao baixar contrato.' }, { status: 500 });
  }
}
