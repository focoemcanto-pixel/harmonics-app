import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { dispatchOutbox } from '@/lib/ai/inbox/service.mjs';

export const dynamic = 'force-dynamic';

// Rascunho da IA (modo 'draft'): aprovar (opcionalmente editado) envia como humano; descartar cancela.
export async function POST(request, { params }) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][DRAFT]' });
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const workspaceId = guard.auth.workspaceId;

  if (body?.action === 'discard') {
    const { data } = await guard.supabase.from('ai_message_outbox').update({ status: 'cancelled', last_error: 'discarded' })
      .eq('id', id).eq('workspace_id', workspaceId).eq('status', 'draft').select('id').maybeSingle();
    return NextResponse.json({ ok: Boolean(data) }, { status: data ? 200 : 404 });
  }
  if (body?.action !== 'approve') return NextResponse.json({ ok: false, error: 'Ação inválida.' }, { status: 400 });

  const content = typeof body?.content === 'string' ? body.content.trim().slice(0, 4000) : null;
  const { data: draft } = await guard.supabase.from('ai_message_outbox').select('conversation_id')
    .eq('id', id).eq('workspace_id', workspaceId).eq('status', 'draft').maybeSingle();
  if (!draft) return NextResponse.json({ ok: false, error: 'Rascunho não encontrado.' }, { status: 404 });

  // Aprovar = humano assume a conversa e envia o texto revisado.
  await guard.supabase.rpc('ai_switch_conversation_owner', {
    p_workspace_id: workspaceId, p_conversation_id: draft.conversation_id, p_to_owner: 'human',
    p_reason: 'draft_approved', p_actor_user_id: guard.auth.userId,
  });
  const { data, error } = await guard.supabase.rpc('ai_approve_draft', {
    p_workspace_id: workspaceId, p_outbox_id: id, p_actor_user_id: guard.auth.userId, p_content: content,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row?.outbox_id) return NextResponse.json({ ok: false, error: 'Rascunho indisponível.' }, { status: 409 });
  const results = await dispatchOutbox({ supabase: guard.supabase, workspaceId, limit: 5 });
  const mine = results.find((r) => r.id === row.outbox_id);
  return NextResponse.json({ ok: true, status: mine?.status || 'pending', error: mine?.error || null });
}
