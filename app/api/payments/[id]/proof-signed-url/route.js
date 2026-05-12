import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import { safeLogFileAccess } from '@/lib/files/log-file-access';
import {
  createPaymentProofSignedUrl,
  resolveProofPreviewFromStoredUrl,
} from '@/lib/payments/payment-proof-storage';

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
      moduleKey: 'pagamentos',
      actionKey: 'read',
      logPrefix: '[PAYMENT_PROOF_SIGNED_URL_API]',
    });

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: auth.error || 'Acesso não autorizado.' },
        { status: auth.status || 401 }
      );
    }

    const resolvedParams = await context?.params;
    const paymentId = String(resolvedParams?.id || '').trim();

    if (!paymentId) {
      return NextResponse.json({ ok: false, error: 'ID do pagamento é obrigatório.' }, { status: 400 });
    }

    const url = new URL(request.url);
    const expiresIn = normalizeExpiresIn(url.searchParams.get('expiresIn'));

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, workspace_id, proof_file_url')
      .eq('id', paymentId)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    if (paymentError) throw paymentError;

    if (!payment?.id) {
      return NextResponse.json(
        { ok: false, error: 'Pagamento não encontrado neste workspace.' },
        { status: 404 }
      );
    }

    if (!payment.proof_file_url) {
      return NextResponse.json(
        { ok: false, error: 'Pagamento sem comprovante disponível.' },
        { status: 404 }
      );
    }

    const storage = resolveProofPreviewFromStoredUrl(payment.proof_file_url, {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });

    auditContext = {
      auth,
      paymentId,
      expiresIn,
      storage,
    };

    if (!storage.bucket || !storage.path) {
      await safeLogFileAccess({
        supabase,
        request,
        workspaceId: auth.workspaceId,
        entityType: 'payment_proof',
        entityId: paymentId,
        bucketId: storage.bucket || null,
        objectPath: storage.path || null,
        expiresInSeconds: expiresIn,
        actorUserId: auth.userId || null,
        actorRole: auth.role || null,
        status: 'failed',
        errorMessage: 'Comprovante não possui referência de storage válida.',
      });

      return NextResponse.json(
        { ok: false, error: 'Comprovante não possui referência de storage válida.' },
        { status: 422 }
      );
    }

    const storageWorkspaceId = storage.workspaceId ? String(storage.workspaceId) : '';
    if (storageWorkspaceId && storageWorkspaceId !== String(auth.workspaceId)) {
      await safeLogFileAccess({
        supabase,
        request,
        workspaceId: auth.workspaceId,
        entityType: 'payment_proof',
        entityId: paymentId,
        bucketId: storage.bucket,
        objectPath: storage.path,
        expiresInSeconds: expiresIn,
        actorUserId: auth.userId || null,
        actorRole: auth.role || null,
        status: 'failed',
        errorMessage: 'Comprovante pertence a outro workspace.',
        metadata: { storageWorkspaceId },
      });

      return NextResponse.json(
        { ok: false, error: 'Comprovante pertence a outro workspace.' },
        { status: 403 }
      );
    }

    const signed = await createPaymentProofSignedUrl({
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
        entityType: 'payment_proof',
        entityId: paymentId,
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
      entityType: 'payment_proof',
      entityId: paymentId,
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
      paymentId,
      url: signed.url,
      expiresIn,
      storage: {
        bucket: storage.bucket,
        path: storage.path,
        workspaceId: storage.workspaceId || null,
      },
    });
  } catch (error) {
    console.error('[PAYMENT_PROOF_SIGNED_URL_API][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    if (auditContext?.auth?.workspaceId) {
      await safeLogFileAccess({
        supabase,
        request,
        workspaceId: auditContext.auth.workspaceId,
        entityType: 'payment_proof',
        entityId: auditContext.paymentId || null,
        bucketId: auditContext.storage?.bucket || null,
        objectPath: auditContext.storage?.path || null,
        expiresInSeconds: auditContext.expiresIn || null,
        actorUserId: auditContext.auth.userId || null,
        actorRole: auditContext.auth.role || null,
        status: 'failed',
        errorMessage: error?.message || 'Erro ao gerar URL temporária do comprovante.',
      });
    }

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao gerar URL temporária do comprovante.' },
      { status: 500 }
    );
  }
}
