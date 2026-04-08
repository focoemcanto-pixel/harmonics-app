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

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    state: crypto.randomBytes(16).toString('hex'),
    scope: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents',
    ],
  });

  const urlWithUserId = new URL(url);
  urlWithUserId.searchParams.set('state', `${urlWithUserId.searchParams.get('state')}:${userId}`);
  return NextResponse.redirect(urlWithUserId.toString());
}
