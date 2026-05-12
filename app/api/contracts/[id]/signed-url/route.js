import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import { safeLogFileAccess } from '@/lib/files/log-file-access';
import {
  createContractSignedUrl,
  resolveContractStoragePath,
} from '@/lib/contracts/contract-storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeExpiresIn(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 60 * 30;
  return Math.min(Math.max(Math.trunc(parsed), 60), 60 * 60 * 24);
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
      logPrefix: '[CONTRACT_SIGNED_URL_API]',
    });

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: auth.error || 'Acesso não autorizado.' },
        { status: auth.status || 401 }
      );
    }

    const resolvedParams = await context?.params;
    const contractId = String(resolvedParams?.id || '').trim();

    if (!contractId) {
      return NextResponse.json({ ok: false, error: 'ID do contrato é obrigatório.' }, { status: 400 });
    }

    const url = new URL(request.url);
    const expiresIn = normalizeExpiresIn(url.searchParams.get('expiresIn'));

    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id, workspace_id, pdf_url')
      .eq('id', contractId)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    if (contractError) throw contractError;

    if (!contract?.id) {
      return NextResponse.json(
        { ok: false, error: 'Contrato não encontrado neste workspace.' },
        { status: 404 }
      );
    }

    if (!contract.pdf_url) {
      return NextResponse.json(
        { ok: false, error: 'Contrato sem PDF disponível.' },
        { status: 404 }
      );
    }

    const storage = resolveContractStoragePath(contract.pdf_url);
    auditContext = {
      auth,
      contractId,
      expiresIn,
      storage,
    };

    if (!storage.bucket || !storage.path) {
      await safeLogFileAccess({
        supabase,
        request,
        workspaceId: auth.workspaceId,
        entityType: 'contract',
        entityId: contractId,
        bucketId: storage.bucket || null,
        objectPath: storage.path || null,
        expiresInSeconds: expiresIn,
        actorUserId: auth.userId || null,
        actorRole: auth.role || null,
        status: 'failed',
        errorMessage: 'PDF do contrato não possui referência de storage válida.',
      });

      return NextResponse.json(
        { ok: false, error: 'PDF do contrato não possui referência de storage válida.' },
        { status: 422 }
      );
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
        expiresInSeconds: expiresIn,
        actorUserId: auth.userId || null,
        actorRole: auth.role || null,
        status: 'failed',
        errorMessage: 'PDF do contrato pertence a outro workspace.',
        metadata: { storageWorkspaceId },
      });

      return NextResponse.json(
        { ok: false, error: 'PDF do contrato pertence a outro workspace.' },
        { status: 403 }
      );
    }

    const signed = await createContractSignedUrl({
      supabase,
      bucket: storage.bucket,
      path: storage.path,
      expiresIn,
    });

    if (signed.error || !signed.url) {
      await safeLogFileAccess({
        supabase,
        request,
        workspaceId: auth.workspaceId,
        entityType: 'contract',
        entityId: contractId,
        bucketId: storage.bucket,
        objectPath: storage.path,
        expiresInSeconds: expiresIn,
        actorUserId: auth.userId || null,
        actorRole: auth.role || null,
        status: 'failed',
        errorMessage: signed.error?.message || 'Não foi possível gerar URL temporária.',
      });

      return NextResponse.json(
        { ok: false, error: signed.error?.message || 'Não foi possível gerar URL temporária.' },
        { status: 500 }
      );
    }

    await safeLogFileAccess({
      supabase,
      request,
      workspaceId: auth.workspaceId,
      entityType: 'contract',
      entityId: contractId,
      bucketId: storage.bucket,
      objectPath: storage.path,
      expiresInSeconds: expiresIn,
      actorUserId: auth.userId || null,
      actorRole: auth.role || null,
      status: 'success',
      metadata: { signedUrlGenerated: true },
    });

    return NextResponse.json({
      ok: true,
      contractId,
      url: signed.url,
      expiresIn,
      storage: {
        bucket: storage.bucket,
        path: storage.path,
        workspaceId: storage.workspaceId || null,
      },
    });
  } catch (error) {
    console.error('[CONTRACT_SIGNED_URL_API][ERROR]', {
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
        expiresInSeconds: auditContext.expiresIn || null,
        actorUserId: auditContext.auth.userId || null,
        actorRole: auditContext.auth.role || null,
        status: 'failed',
        errorMessage: error?.message || 'Erro ao gerar URL temporária do contrato.',
      });
    }

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao gerar URL temporária do contrato.' },
      { status: 500 }
    );
  }
}
