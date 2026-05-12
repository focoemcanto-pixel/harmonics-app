import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import { safeLogFileAccess } from '@/lib/files/log-file-access';
import { trackUsageEvent } from '@/lib/usage/track-usage-event';
import { resolveProofPreviewFromStoredUrl } from '@/lib/payments/payment-proof-storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function sanitizeFileName(value, fallback = 'comprovante') {
  const clean = String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120);

  return clean || fallback;
}

function getExtension(path) {
  const clean = String(path || '').split('?')[0].split('#')[0];
  const match = clean.match(/\.([a-zA-Z0-9]{1,12})$/);
  return match?.[1] ? `.${match[1].toLowerCase()}` : '';
}

function resolveContentType(blob, path) {
  const fromBlob = blob?.type && blob.type !== 'application/octet-stream' ? blob.type : '';
  if (fromBlob) return fromBlob;

  const lower = String(path || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';

  return 'application/octet-stream';
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
      logPrefix: '[PAYMENT_PROOF_DOWNLOAD_PROXY]',
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

    const { data: payment, error } = await supabase
      .from('payments')
      .select('id, workspace_id, proof_file_url, payment_method, payment_date')
      .eq('id', paymentId)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    if (error) throw error;

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

    auditContext = { auth, paymentId, storage };

    if (!storage.bucket || !storage.path) {
      await safeLogFileAccess({
        supabase,
        request,
        workspaceId: auth.workspaceId,
        entityType: 'payment_proof',
        entityId: paymentId,
        bucketId: storage.bucket || null,
        objectPath: storage.path || null,
        accessType: 'download_proxy',
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
        accessType: 'download_proxy',
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

    const { data: blob, error: downloadError } = await supabase.storage
      .from(storage.bucket)
      .download(storage.path);

    if (downloadError || !blob) {
      throw new Error(downloadError?.message || 'Não foi possível baixar o comprovante.');
    }

    const contentType = resolveContentType(blob, storage.path);

    await safeLogFileAccess({
      supabase,
      request,
      workspaceId: auth.workspaceId,
      entityType: 'payment_proof',
      entityId: paymentId,
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
      entityType: 'payment_proof',
      entityId: paymentId,
      source: 'payment_proof_download_proxy',
      metadata: {
        bucket: storage.bucket,
        path: storage.path,
        contentType,
      },
    });

    const fileName = sanitizeFileName(`comprovante-${paymentId}${getExtension(storage.path)}`);

    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[PAYMENT_PROOF_DOWNLOAD_PROXY][ERROR]', {
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
        accessType: 'download_proxy',
        actorUserId: auditContext.auth.userId || null,
        actorRole: auditContext.auth.role || null,
        status: 'failed',
        errorMessage: error?.message || 'Erro no proxy de download do comprovante.',
      });
    }

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao baixar comprovante.' },
      { status: 500 }
    );
  }
}
