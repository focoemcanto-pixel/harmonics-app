import { NextResponse } from 'next/server';
import { sendAdminAccessInvite } from '@/lib/admin/admin-access-invite';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function POST(request) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body?.email);

    const result = await sendAdminAccessInvite({ email });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
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
    console.error('[ADMIN_USERS][INVITE_ERROR]', {
      message: error?.message || 'Erro interno do servidor',
      stack: error?.stack || null,
    });

    return NextResponse.json(
      { error: error?.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
