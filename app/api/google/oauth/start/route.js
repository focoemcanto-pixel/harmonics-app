import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

function extractUserIdFromAuthenticatedSession(request) {
  const requestUserId = String(request?.user?.id || '').trim();
  if (requestUserId) return requestUserId;

  const sessionUserId = String(request?.session?.user?.id || request?.session?.userId || '').trim();
  if (sessionUserId) return sessionUserId;

  return '';
}

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

export async function GET(request) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  const userId = extractUserIdFromAuthenticatedSession(request);

  if (!userId) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Usuário não autenticado. Não foi possível resolver userId via req.user/req.session.',
      },
      { status: 401 }
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  const state = buildSignedState(userId);

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    state,
    scope: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents',
    ],
  });

  return NextResponse.redirect(url);
}
