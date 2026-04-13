import { NextResponse } from 'next/server';
import { sendInviteService } from '../../../../lib/whatsapp/send-invite-service';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const inviteId = body?.inviteId;
  console.info('[automation][step] send_invite_started', { inviteId });

  const result = await sendInviteService({ inviteId });

  if (!result.ok) {
    console.error('[automation][step] send_invite_failed', {
      inviteId,
      status: result.status,
      error: result.error,
    });
  }

  return NextResponse.json(
    result.data || { error: result.error || 'Erro interno ao enviar convite' },
    { status: result.status }
  );
}
