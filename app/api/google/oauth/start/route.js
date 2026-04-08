import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  const { searchParams } = new URL(request.url);
  const userId = String(searchParams.get('user_id') || '').trim();

  if (!userId) {
    return NextResponse.json(
      { ok: false, message: 'Parâmetro user_id é obrigatório.' },
      { status: 400 }
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  const nonce = crypto.randomBytes(16).toString('hex');
  const encodedUserId = Buffer.from(userId, 'utf8').toString('base64url');
  const state = `${nonce}:${encodedUserId}`;

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
