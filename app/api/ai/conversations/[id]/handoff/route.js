import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';

export const dynamic = 'force-dynamic';

// IA desligada por padrão. Este endpoint NÃO ativa canais nem envia mensagens.
// Somente administradores do workspace podem trocar o responsável.
export async function POST(request, { params }) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][HANDOFF]' });
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const toOwner = body?.owner;
  if (toOwner !== 'human' && toOwner !== 'ai') {
    return NextResponse.json({ ok: false, error: 'Responsável inválido.' }, { status: 400 });
  }

  const workspaceId = guard.auth.workspaceId;
  if (!workspaceId || !id) {
    return NextResponse.json({ ok: false, error: 'Conversa indisponível.' }, { status: 404 });
  }

  // A RPC executa troca/versionamento/cancelamento pendente atomicamente.
  // Não aceitar workspace_id do corpo da requisição.
  const { data, error } = await guard.supabase.rpc('ai_switch_conversation_owner', {
    p_workspace_id: workspaceId,
    p_conversation_id: id,
    p_to_owner: toOwner,
    p_reason: typeof body?.reason === 'string' ? body.reason.slice(0, 500) : null,
    p_actor_user_id: null,
  });

  if (error) {
    console.error('[AI][HANDOFF][ERROR]', { code: error.code });
    return NextResponse.json({ ok: false, error: 'Não foi possível transferir atendimento.' }, { status: 409 });
  }

  const result = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    ok: true,
    conversation_id: result?.conversation_id,
    owner: result?.new_owner,
    owner_version: result?.new_owner_version,
  });
}
