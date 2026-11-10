import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { getConversationDetail } from '@/lib/ai/inbox/inbox-queries.mjs';
import { isMetaTestChannel } from '@/lib/ai/inbox/service.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][CONVERSATION]' });
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const before = new URL(request.url).searchParams.get('before');
  const detail = await getConversationDetail({ supabase: guard.supabase, workspaceId: guard.auth.workspaceId, conversationId: id, before });
  if (!detail.conversation) return NextResponse.json({ ok: false, error: 'Conversa não encontrada.' }, { status: 404 });
  const { data: channel } = await guard.supabase.from('ai_channels').select('display_phone')
    .eq('workspace_id', guard.auth.workspaceId).eq('provider', 'meta_cloud').maybeSingle();
  return NextResponse.json({ ok: true, ...detail, is_test_channel: isMetaTestChannel(channel) });
}

// Encerrar/reabrir conversa.
export async function PATCH(request, { params }) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][CONVERSATION][PATCH]' });
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!['open', 'closed'].includes(body?.state)) {
    return NextResponse.json({ ok: false, error: 'Estado inválido.' }, { status: 400 });
  }
  const { data, error } = await guard.supabase.from('ai_conversations')
    .update({ state: body.state, needs_human: body.state === 'closed' ? false : undefined, updated_at: new Date().toISOString() })
    .eq('id', id).eq('workspace_id', guard.auth.workspaceId).select('id, state').maybeSingle();
  if (error || !data) return NextResponse.json({ ok: false, error: 'Conversa não encontrada.' }, { status: 404 });
  return NextResponse.json({ ok: true, conversation: data });
}
