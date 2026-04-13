import { NextResponse } from 'next/server';
import { sendInviteService } from '../../../../lib/whatsapp/send-invite-service';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const inviteId = body?.inviteId;
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
