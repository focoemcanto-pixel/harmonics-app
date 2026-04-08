import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@/lib/supabase/server';

function buildSignedState(userId) {
  const stateSecret = String(
    process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  ).trim();
  if (!stateSecret) {
    throw new Error('GOOGLE_OAUTH_STATE_SECRET (ou SUPABASE_SERVICE_ROLE_KEY) é obrigatório.');
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  const encodedUserId = Buffer.from(userId, 'utf8').toString('base64url');
  const issuedAt = Date.now().toString();
  const payload = `${nonce}.${encodedUserId}.${issuedAt}`;
  const signature = crypto.createHmac('sha256', stateSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function buildOAuthClient() {
  const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
  const redirectUri = String(process.env.GOOGLE_OAUTH_REDIRECT_URI || '').trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Configuração OAuth incompleta (client_id, client_secret ou redirect_uri).');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function POST() {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.id) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Usuário não autenticado',
          error: error?.message,
        },
        { status: 401 }
      );
    }

    const userId = user.id;
    const oauth2Client = buildOAuthClient();
    const state = buildSignedState(userId);

    const reauthUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      state,
      scope: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/documents',
      ],
    });

    return NextResponse.json({
      ok: true,
      reauthUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'Erro ao iniciar OAuth Google.',
      },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  return POST(req);
}
