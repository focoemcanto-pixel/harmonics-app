import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { decryptSecret } from '@/lib/ai/inbox/secret-box.mjs';
import { downloadMedia } from '@/lib/ai/inbox/meta-client.mjs';
import { buildWorkspacePaymentProofPath, resolvePaymentProofBucketName } from '@/lib/payments/payment-proof-storage';

export const dynamic = 'force-dynamic';
const extensions = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const fail = (error, status) => NextResponse.json({ ok: false, error }, { status });

async function loadProof(request, params) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][PROOF]' });
  if (!guard.ok) return { response: guard.response };
  const { id } = await params;
  const { workspaceId, userId } = guard.auth;
  const { supabase } = guard;
  const { data: evidence } = await supabase.from('ai_payment_evidence').select('conversation_id,provider_message_id')
    .eq('workspace_id', workspaceId).eq('message_id', id).maybeSingle();
  if (!evidence) return { response: fail('Comprovante indisponível.', 404) };
  const { data: message } = await supabase.from('ai_messages').select('media_id,media_mime')
    .eq('workspace_id', workspaceId).eq('id', id).eq('conversation_id', evidence.conversation_id)
    .eq('provider_message_id', evidence.provider_message_id).eq('direction','inbound').eq('origin','customer').maybeSingle();
  const { data: channel } = await supabase.from('ai_channels').select('access_token_encrypted')
    .eq('workspace_id', workspaceId).eq('provider','meta_cloud').maybeSingle();
  if (!message?.media_id || !channel?.access_token_encrypted) return { response: fail('Mídia indisponível.', 409) };
  const token = await decryptSecret(channel.access_token_encrypted);
  const { bytes, mime } = await downloadMedia({ mediaId: message.media_id, token, maxBytes: 10 * 1024 * 1024 });
  if (!Object.hasOwn(extensions,mime) || mime !== message.media_mime) return { response: fail('Tipo de arquivo incompatível.', 422) };
  return { id, userId, workspaceId, supabase, bytes, mime, conversationId: evidence.conversation_id };
}

export async function GET(request, { params }) {
  try {
    const proof = await loadProof(request, params);
    if (proof.response) return proof.response;
    return new Response(proof.bytes, { headers: { 'Content-Type': proof.mime, 'Cache-Control': 'no-store',
      'Content-Disposition': 'attachment; filename="comprovante.' + extensions[proof.mime] + '"', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return fail('Falha ao recuperar o arquivo da Meta.', 502); }
}

export async function POST(request, { params }) {
  try {
    const body = await request.json();
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body?.eventId) ||
        !Number.isSafeInteger(body.cents) || body.cents < 1 || body.cents > 9999999999 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(body.day) || !['pix','transferencia','deposito','boleto','cartao','dinheiro'].includes(body.method))
      return fail('Confira evento, valor, data e forma de pagamento.', 400);
    const proof = await loadProof(request, params);
    if (proof.response) return proof.response;
    const { supabase, workspaceId, id, userId, bytes, mime } = proof;
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    const digest = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2,'0')).join('');
    const path = buildWorkspacePaymentProofPath({ workspaceId, eventId: body.eventId, fileName: digest + '.' + extensions[mime] });
    const { data: event } = await supabase.from('events').select('id,whatsapp_phone').eq('workspace_id',workspaceId).eq('id',body.eventId).maybeSingle();
    const { data: conversation } = await supabase.from('ai_conversations').select('provider_chat_id')
      .eq('workspace_id',workspaceId).eq('id',proof.conversationId).maybeSingle();
    const digits = value => String(value || '').replace(/\D/g,'');
    const sender = digits(conversation?.provider_chat_id);
    if (!event || sender.length < 10 || sender !== digits(event.whatsapp_phone)) return fail('O telefone do evento não corresponde ao remetente.',409);
    const { error: storageError } = await supabase.storage.from(resolvePaymentProofBucketName())
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (storageError && String(storageError.statusCode) !== '409' && storageError.error !== 'Duplicate') return fail('Falha ao arquivar o comprovante.',502);
    const { data, error } = await supabase.rpc('ai_review_payment_proof', { p_workspace: workspaceId,p_message:id,p_actor:userId,
      p_event:body.eventId,p_cents:body.cents,p_day:body.day,p_method:body.method,p_digest:digest,p_path:path });
    if (error) return fail('Confira o vínculo com o cliente e os lançamentos existentes antes de aprovar.',409);
    return NextResponse.json({ ok:true, paymentId:data });
  } catch { return fail('Não foi possível registrar o comprovante.',502); }
}
