import { NextResponse, after } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { verifyMetaChallenge, verifyMetaSignature } from '@/lib/ai/inbox/meta-webhook.mjs';
import { ingestWebhook, processConversationReply, dispatchOutbox } from '@/lib/ai/inbox/service.mjs';

export const dynamic = 'force-dynamic';

const DEBOUNCE_MS = Number(process.env.AI_INBOX_DEBOUNCE_MS || 4000);

// Verificação do webhook (Meta App Dashboard → WhatsApp → Configuration).
export async function GET(request) {
  const result = verifyMetaChallenge(new URL(request.url).searchParams, process.env.META_WEBHOOK_VERIFY_TOKEN);
  if (!result.ok) return new NextResponse('Forbidden', { status: result.status });
  return new NextResponse(result.challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

// Recebimento: assinatura X-Hub-Signature-256 obrigatória (falha fechada), dedupe por hash do
// corpo + ID de mensagem, persistência transacional e resposta rápida. A IA roda depois da
// resposta (after) e também pelo cron /api/cron/ai-inbox como garantia.
export async function POST(request) {
  const rawBody = await request.text();
  const signature = await verifyMetaSignature({
    rawBody,
    signatureHeader: request.headers.get('x-hub-signature-256'),
    appSecret: process.env.META_APP_SECRET,
  });
  if (!signature.ok) {
    console.warn('[AI][WEBHOOK][REJECTED]', { reason: signature.reason });
    return NextResponse.json({ ok: false }, { status: signature.status });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  let result;
  try {
    result = await ingestWebhook({ supabase, rawBody, payload });
  } catch (error) {
    // 500 => a Meta reenvia; a deduplicação torna o reenvio seguro.
    console.error('[AI][WEBHOOK][ERROR]', { code: error?.code || null, message: error?.message });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  console.info('[AI][WEBHOOK]', { duplicate: result.duplicate, ...(result.stats || {}), pending: result.pending.length });

  if (result.pending.length) {
    after(async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS));
        for (const item of result.pending) {
          await processConversationReply({ supabase, workspaceId: item.workspaceId, conversationId: item.conversationId });
          await dispatchOutbox({ supabase, workspaceId: item.workspaceId });
        }
      } catch (error) {
        console.error('[AI][WEBHOOK][AFTER][ERROR]', { message: error?.message });
      }
    });
  }

  return NextResponse.json({ ok: true });
}
