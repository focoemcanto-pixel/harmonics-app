import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';

export const dynamic = 'force-dynamic';

// LGPD: exclusão definitiva das conversas/mensagens do titular neste workspace (admin).
// Exige confirmação explícita no corpo. Não afeta contatos, eventos ou contratos.
export async function POST(request, { params }) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][ERASE]' });
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== 'EXCLUIR') {
    return NextResponse.json({ ok: false, error: 'Confirmação obrigatória.' }, { status: 400 });
  }
  const workspaceId = guard.auth.workspaceId;
  const { data: conversation } = await guard.supabase.from('ai_conversations').select('provider_chat_id')
    .eq('id', id).eq('workspace_id', workspaceId).maybeSingle();
  if (!conversation) return NextResponse.json({ ok: false, error: 'Conversa não encontrada.' }, { status: 404 });
  const { data, error } = await guard.supabase.rpc('ai_erase_contact', {
    p_workspace_id: workspaceId, p_provider_chat_id: conversation.provider_chat_id,
  });
  if (error) return NextResponse.json({ ok: false, error: 'Falha na exclusão.' }, { status: 500 });
  console.info('[AI][ERASE]', { workspaceId, conversations: data });
  return NextResponse.json({ ok: true, deleted: data });
}
