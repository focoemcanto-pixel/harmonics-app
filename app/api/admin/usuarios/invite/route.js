import { NextResponse } from 'next/server';
import { sendAdminAccessInvite } from '@/lib/admin/admin-access-invite';
import { requireAdminServer } from '@/lib/api/require-admin-server';
import { logError, logInfo, maskEmail } from '@/lib/observability/server-log';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function POST(request) {
  const adminGuard = await requireAdminServer(request);

  if (!adminGuard.ok) {
    return adminGuard.response;
  }

  try {
    const body = await request.json();
    const email = normalizeEmail(body?.email);
    logInfo('ADMIN_USERS_INVITE', 'START', { email: maskEmail(email) });

    const result = await sendAdminAccessInvite({ email });

    if (!result.ok) {
      logError('ADMIN_USERS_INVITE', 'SEND_FAILED', new Error(result.error || 'Falha ao enviar convite'), {
        status: result.status || 500,
        email: maskEmail(email),
      });
      return NextResponse.json(
        { ok: false, error: result.error || 'Falha ao enviar convite.' },
        { status: result.status || 500 }
      );
    }

    const payload = {
      ok: true,
      inviteSent: Boolean(result.inviteSent),
      provider: result.provider || 'resend',
      email,
    };

    if (result.inviteError) {
      payload.inviteError = result.inviteError;
    }

    if (process.env.NODE_ENV === 'development' && result.inviteLink) {
      payload.inviteLink = result.inviteLink;
    }

    return NextResponse.json(payload);
  } catch (error) {
    logError('ADMIN_USERS_INVITE', 'ERROR', error);

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
