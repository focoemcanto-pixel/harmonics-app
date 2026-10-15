import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  createPaymentProofSignedUrl,
  extractWorkspaceIdFromPaymentProofPath,
  resolvePaymentProofBucketName,
  resolveProofPreviewFromStoredUrl,
} from '@/lib/payments/payment-proof-storage';
import { isPaymentInPortalScope, resolvePortalTokenScope } from '@/lib/files/portal-token-scope';
import { isStoredFileReference } from '@/lib/files/public-file-links';

export const dynamic = 'force-dynamic';

// Comprovante de pagamento para quem tem o link do portal do cliente (token), entregue por URL
// assinada de curta duração. Mesmo modelo de /api/public/files/contract/<token>: prepara o
// fechamento do bucket público sem quebrar o portal.
const SIGNED_URL_TTL_SECONDS = 10 * 60;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound() {
  return NextResponse.json({ ok: false, error: 'Arquivo não encontrado.' }, { status: 404 });
}

// Assina apenas objetos do bucket de comprovantes e, quando o caminho traz o workspace, do mesmo
// workspace do pagamento.
function isSignableForPayment(payment, bucket, path) {
  if (!bucket || !path) return false;
  const allowedBuckets = new Set([resolvePaymentProofBucketName(), 'payment-proofs']);
  if (!allowedBuckets.has(bucket)) return false;
  const pathWorkspaceId = extractWorkspaceIdFromPaymentProofPath(path);
  if (pathWorkspaceId && payment.workspace_id && String(pathWorkspaceId) !== String(payment.workspace_id)) return false;
  return true;
}

export async function GET(request, context) {
  const params = await context?.params;
  const token = String(params?.token || '').trim();
  if (!token || token.length < 8 || token.length > 200) return notFound();

  let paymentId = '';
  try {
    paymentId = String(new URL(request?.url || '').searchParams.get('p') || '').trim();
  } catch {
    paymentId = '';
  }
  if (!UUID_REGEX.test(paymentId)) return notFound();

  const supabase = getSupabaseAdmin();
  const { data: payment } = await supabase
    .from('payments')
    .select('id, event_id, workspace_id, proof_file_url')
    .eq('id', paymentId)
    .maybeSingle();
  if (!payment?.proof_file_url) return notFound();

  const scope = await resolvePortalTokenScope(supabase, token);
  if (!isPaymentInPortalScope(scope, payment)) return notFound();

  const stored = String(payment.proof_file_url).trim();
  if (!isStoredFileReference(stored)) return notFound();
  const { bucket, path } = resolveProofPreviewFromStoredUrl(stored);
  if (!isSignableForPayment(payment, bucket, path)) return notFound();

  const { url, error } = await createPaymentProofSignedUrl({ supabase, bucket, path, expiresIn: SIGNED_URL_TTL_SECONDS });
  if (error || !url) {
    console.error('[PUBLIC_PAYMENT_PROOF][SIGNED_URL_FAILED]', { paymentId: payment.id, message: error?.message });
    return NextResponse.json({ ok: false, error: 'Não foi possível abrir o comprovante agora.' }, { status: 502 });
  }

  return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'no-store' } });
}
