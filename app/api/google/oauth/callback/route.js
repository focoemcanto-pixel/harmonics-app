import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request) {
  try {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { ok: false, message: 'Code não recebido do Google.' },
        { status: 400 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);
    const normalizedTokens = normalizeGoogleTokens(tokens);

    return NextResponse.json({
      ok: true,
      message: 'Tokens obtidos com sucesso.',
      tokens: normalizedTokens,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'Erro ao concluir OAuth Google.',
      },
      { status: 500 }
    );
  }
}

function normalizeGoogleTokens(tokens) {
  const safeTokens = tokens && typeof tokens === 'object' ? tokens : {};
  const refreshToken = String(safeTokens.refresh_token || '').trim();

  return {
    ...safeTokens,
    refresh_token: refreshToken,
  };
}
