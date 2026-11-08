import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';

export const dynamic = 'force-dynamic';

// Fase de visualização: somente owner/admin do workspace assume ou devolve conversas.
// A RPC troca titularidade, incrementa a versão e cancela a fila pendente da IA atomicamente.
// workspace_id vem SEMPRE da sessão, nunca do corpo.
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

  const { data, error } = await guard.supabase.rpc('ai_switch_conversation_owner', {
    p_workspace_id: workspaceId,
    p_conversation_id: id,
    p_to_owner: toOwner,
    p_reason: typeof body?.reason === 'string' ? body.reason.slice(0, 500) : 'manual',
    p_actor_user_id: guard.auth.userId || null,
  });

  if (error) {
    console.error('[AI][HANDOFF][ERROR]', { code: error.code });
    const status = error.code === 'P0002' ? 404 : 409;
    return NextResponse.json({ ok: false, error: 'Não foi possível transferir atendimento.' }, { status });
  }

  const result = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    ok: true,
    conversation_id: result?.conversation_id,
    owner: result?.new_owner,
    owner_version: result?.new_owner_version,
  });
}
