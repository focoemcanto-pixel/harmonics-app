import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import {
  createPaymentProofSignedUrl,
  extractBucketAndPathFromProofUrl,
  extractWorkspaceIdFromPaymentProofPath,
  resolvePaymentProofBucketName,
} from '@/lib/payments/payment-proof-storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizePath(value) {
  return String(value || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\.\./g, '')
    .replace(/\/+/g, '/');
}

function safeDecodeRef(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function resolveProofReference(reference) {
  const decoded = safeDecodeRef(reference);
  if (!decoded) return { bucket: null, path: null, workspaceId: null, raw: '' };

  const parsed = extractBucketAndPathFromProofUrl(decoded);
  if (parsed?.bucket && parsed?.path) {
    return { ...parsed, raw: decoded };
  }

  const path = normalizePath(decoded);
  return {
    bucket: resolvePaymentProofBucketName(),
    path,
    workspaceId: extractWorkspaceIdFromPaymentProofPath(path),
    raw: decoded,
  };
}

async function findMatchingPayment({ supabase, workspaceId, proofReference, bucket, path }) {
  const normalizedPath = normalizePath(path);
  const candidates = Array.from(
    new Set(
      [proofReference, normalizedPath]
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  );

  if (candidates.length === 0) return null;

  const { data, error } = await supabase
    .from('payments')
    .select('id, workspace_id, proof_file_url')
    .eq('workspace_id', workspaceId)
    .in('proof_file_url', candidates)
    .limit(1);

  if (error) {
    console.error('[PAYMENT_PROOF_PREVIEW][PAYMENT_LOOKUP_ERROR]', {
      message: error?.message,
      code: error?.code,
    });
    return null;
  }

  if (data?.[0]) return data[0];

  // Fallback para URLs públicas antigas: compara por sufixo/path mantendo workspace.
  const { data: fallbackData, error: fallbackError } = await supabase
    .from('payments')
    .select('id, workspace_id, proof_file_url')
    .eq('workspace_id', workspaceId)
    .ilike('proof_file_url', `%${normalizedPath}`)
    .limit(1);

  if (fallbackError) {
    console.error('[PAYMENT_PROOF_PREVIEW][PAYMENT_FALLBACK_ERROR]', {
      message: fallbackError?.message,
      code: fallbackError?.code,
    });
    return null;
  }

  return fallbackData?.[0] || null;
}

export async function GET(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      allowedRoles: ['owner', 'admin', 'administrador', 'financeiro'],
      logPrefix: '[PAYMENT_PROOF_PREVIEW]',
    });

    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
    }

    const { searchParams } = new URL(request.url);
    const ref = searchParams.get('ref') || '';
    const expiresInRaw = Number(searchParams.get('expiresIn') || 60 * 5);
    const expiresIn = Number.isFinite(expiresInRaw)
      ? Math.min(Math.max(Math.trunc(expiresInRaw), 60), 60 * 60)
      : 60 * 5;

    const resolved = resolveProofReference(ref);

    if (!resolved.path) {
      return NextResponse.json({ ok: false, error: 'Referência de comprovante inválida.' }, { status: 400 });
    }

    if (resolved.workspaceId && resolved.workspaceId !== auth.workspaceId) {
      return NextResponse.json({ ok: false, error: 'Comprovante não pertence a este workspace.' }, { status: 403 });
    }

    const matchingPayment = await findMatchingPayment({
      supabase,
      workspaceId: auth.workspaceId,
      proofReference: resolved.raw,
      bucket: resolved.bucket,
      path: resolved.path,
    });

    if (!matchingPayment?.id) {
      return NextResponse.json({ ok: false, error: 'Comprovante não encontrado neste workspace.' }, { status: 404 });
    }

    const signed = await createPaymentProofSignedUrl({
      supabase,
      bucket: resolved.bucket || resolvePaymentProofBucketName(),
      path: resolved.path,
      expiresIn,
    });

    if (signed.error || !signed.url) {
      return NextResponse.json(
        { ok: false, error: signed.error?.message || 'Não foi possível gerar link temporário.' },
        { status: 500 }
      );
    }

    return NextResponse.redirect(signed.url, { status: 302 });
  } catch (error) {
    console.error('[PAYMENT_PROOF_PREVIEW][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao abrir comprovante.' },
      { status: 500 }
    );
  }
}
