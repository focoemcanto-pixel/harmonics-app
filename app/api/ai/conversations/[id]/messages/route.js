import { NextResponse } from 'next/server';
import { guardWorkspaceMember } from '@/lib/api/route-guards';
import { dispatchOutbox } from '@/lib/ai/inbox/service.mjs';
import { isWithinCustomerServiceWindow } from '@/lib/ai/inbox/meta-client.mjs';

export const dynamic = 'force-dynamic';

// Resposta humana pelo Inbox: assume a conversa (cancela fila da IA) e envia na mesma ação.
export async function POST(request, { params }) {
  const guard = await guardWorkspaceMember(request, { logPrefix: '[AI][HUMAN_SEND]' });
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  const clientKey = typeof body?.client_message_id === 'string' ? body.client_message_id.slice(0, 80) : '';
  if (!content || content.length > 4000) {
    return NextResponse.json({ ok: false, error: 'Mensagem vazia ou longa demais.' }, { status: 400 });
  }
  if (!clientKey) return NextResponse.json({ ok: false, error: 'client_message_id obrigatório.' }, { status: 400 });

  const workspaceId = guard.auth.workspaceId;
  const { data: conversation } = await guard.supabase.from('ai_conversations').select('id, last_inbound_at')
    .eq('id', id).eq('workspace_id', workspaceId).maybeSingle();
  if (!conversation) return NextResponse.json({ ok: false, error: 'Conversa não encontrada.' }, { status: 404 });
  if (!isWithinCustomerServiceWindow(conversation.last_inbound_at)) {
    return NextResponse.json({
      ok: false,
      code: 'OUTSIDE_24H_WINDOW',
      error: 'Fora da janela de 24h do WhatsApp. Responda pelo app WhatsApp Business ou use um modelo aprovado.',
    }, { status: 422 });
  }

  const { data, error } = await guard.supabase.rpc('ai_enqueue_human_message', {
    p_workspace_id: workspaceId,
    p_conversation_id: id,
    p_actor_user_id: guard.auth.userId,
    p_idempotency_key: `human:${guard.auth.userId}:${clientKey}`,
    p_content: content,
  });
  if (error) {
    console.error('[AI][HUMAN_SEND][ERROR]', { code: error.code });
    return NextResponse.json({ ok: false, error: 'Não foi possível enviar.' }, { status: 409 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  const results = await dispatchOutbox({ supabase: guard.supabase, workspaceId, limit: 5 });
  const mine = results.find((r) => r.id === row?.outbox_id);
  return NextResponse.json({ ok: true, outbox_id: row?.outbox_id || null, status: mine?.status || 'pending', error: mine?.error || null });
}
