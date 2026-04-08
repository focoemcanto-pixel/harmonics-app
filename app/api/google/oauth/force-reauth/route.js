import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import {
  deactivateGoogleCredentialsByUserId,
} from '@/lib/contracts/googleCredentials';

function buildOAuthClient() {
  const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
  const redirectUri = String(process.env.GOOGLE_OAUTH_REDIRECT_URI || '').trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Configuração OAuth incompleta (client_id, client_secret ou redirect_uri).');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = String(body?.userId || body?.user_id || '').trim();

    if (!userId) {
      return NextResponse.json(
        { ok: false, message: 'userId (ou user_id) é obrigatório.' },
        { status: 400 }
      );
    }

    const revokeResult = await deactivateGoogleCredentialsByUserId(userId, 'forced_reauth');
    const oauth2Client = buildOAuthClient();
    const state = crypto.randomBytes(24).toString('hex');

    const reauthUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/documents',
      ],
      state: `${state}:${userId}`,
    });

    return NextResponse.json({
      ok: true,
      message: 'Credencial atual invalidada. Reautenticação forçada criada com sucesso.',
      revokeResult,
      reauthUrl,
      state,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'Erro ao iniciar reautenticação segura.',
      },
      { status: 500 }
    );
  }
}
