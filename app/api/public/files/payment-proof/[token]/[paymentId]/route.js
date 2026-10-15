import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  createPaymentProofSignedUrl,
  extractWorkspaceIdFromPaymentProofPath,
  resolvePaymentProofBucketName,
  resolveProofPreviewFromStoredUrl,
} from '@/lib/payments/payment-proof-storage';

export const dynamic = 'force-dynamic';

// Comprovante de pagamento para quem tem o link do portal do cliente (token do evento), entregue
// por URL assinada de curta duração. Prepara o fechamento do bucket público `payment-proofs`.
const SIGNED_URL_TTL_SECONDS = 10 * 60;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound() {
  return NextResponse.json({ ok: false, error: 'Arquivo não encontrado.' }, { status: 404 });
}

// Mesma resolução de token do envio de comprovante (api/cliente/pagamentos) e do portal.
async function resolveEventIdFromToken(supabase, token) {
  const { data: precontract } = await supabase
    .from('precontracts')
    .select('event_id')
    .eq('public_token', token)
    .maybeSingle();
  if (precontract?.event_id) return precontract.event_id;

  const { data: contract } = await supabase
    .from('contracts')
    .select('event_id')
    .eq('public_token', token)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (contract?.event_id) return contract.event_id;

  const { data: config } = await supabase
    .from('repertoire_config')
    .select('event_id')
    .eq('client_public_token', token)
    .limit(1)
    .maybeSingle();
  return config?.event_id || null;
}

function isProjectStorageUrl(value) {
  try {
    const host = new URL(String(value || '').trim()).hostname.toLowerCase();
    const supabaseHost = new URL(String(process.env.NEXT_PUBLIC_SUPABASE_URL || '')).hostname.toLowerCase();
    return Boolean(supabaseHost) && host === supabaseHost;
  } catch {
    return false;
  }
}

export async function GET(_request, context) {
  const params = await context?.params;
  const token = String(params?.token || '').trim();
  const paymentId = String(params?.paymentId || '').trim();
  if (!token || token.length < 8 || token.length > 200 || !UUID_REGEX.test(paymentId)) return notFound();

  const supabase = getSupabaseAdmin();
  const eventId = await resolveEventIdFromToken(supabase, token);
  if (!eventId) return notFound();

  const { data: payment } = await supabase
    .from('payments')
    .select('id, event_id, workspace_id, proof_file_url')
    .eq('id', paymentId)
    .eq('event_id', eventId)
    .maybeSingle();
  const stored = String(payment?.proof_file_url || '').trim();
  if (!stored) return notFound();

  const { bucket, path } = resolveProofPreviewFromStoredUrl(stored);
  const allowedBuckets = new Set([resolvePaymentProofBucketName(), 'payment-proofs']);
  if (!bucket || !path || !allowedBuckets.has(bucket)) return notFound();
  const pathWorkspaceId = extractWorkspaceIdFromPaymentProofPath(path);
  if (pathWorkspaceId && payment.workspace_id && String(pathWorkspaceId) !== String(payment.workspace_id)) return notFound();

  const { url, error } = await createPaymentProofSignedUrl({ supabase, bucket, path, expiresIn: SIGNED_URL_TTL_SECONDS });
  if (error || !url) {
    console.error('[PUBLIC_PAYMENT_PROOF][SIGNED_URL_FAILED]', { paymentId, message: error?.message });
    // Enquanto o bucket for público, a URL original do projeto continua válida.
    if (isProjectStorageUrl(stored)) return NextResponse.redirect(stored, { status: 302 });
    return NextResponse.json({ ok: false, error: 'Não foi possível abrir o comprovante agora.' }, { status: 502 });
  }

  return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'no-store' } });
}
