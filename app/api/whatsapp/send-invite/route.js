import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { sendInviteService } from '../../../../lib/whatsapp/send-invite-service';

export async function POST(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[POST /api/whatsapp/send-invite]' });
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));

  const inviteId = String(body?.inviteId || '').trim();

  if (!inviteId) {
    return NextResponse.json(
      {
        error: 'inviteId é obrigatório',
      },
      { status: 400 }
    );
  }

  const { data: inviteScope, error: inviteScopeError } = await guard.supabase
    .from('invites')
    .select('id, event:events(workspace_id)')
    .eq('id', inviteId)
    .maybeSingle();

  if (inviteScopeError) {
    return NextResponse.json({ error: 'Falha ao validar convite.' }, { status: 500 });
  }

  if (!inviteScope?.id || String(inviteScope?.event?.workspace_id || '') !== String(guard.auth.workspaceId)) {
    return NextResponse.json({ error: 'Convite não encontrado.' }, { status: 404 });
  }

  console.info('[automation][step] send_invite_started', { inviteId });

  const result = await sendInviteService({ inviteId });
  const responseData = result.data || {};

  if (!result.ok) {
    const providerError = responseData.providerError || {};
    const errorPayload = {
      error: result.error || responseData.error || 'Erro interno ao enviar convite',
      cause: responseData.cause || providerError.response?.error || providerError.response?.message || result.error || null,
      providerStatus: responseData.providerStatus ?? providerError.status ?? null,
      providerEndpoint: responseData.providerEndpoint ?? providerError.endpoint ?? null,
      providerResponse:
        responseData.providerResponse ??
        providerError.response ??
        null,
    };

    console.error('[automation][step] send_invite_failed', {
      inviteId,
      status: result.status,
      error: errorPayload.error,
      cause: errorPayload.cause,
      providerStatus: errorPayload.providerStatus,
      providerEndpoint: errorPayload.providerEndpoint,
      providerResponse: errorPayload.providerResponse,
    });

    return NextResponse.json(errorPayload, { status: result.status });
  }

  return NextResponse.json(responseData, { status: result.status });
}
