import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import {
  normalizeGoogleCredentials,
  persistGoogleCredentialsToSupabase,
} from '@/lib/contracts/googleCredentials';

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
    const normalizedTokens = normalizeGoogleCredentials(tokens);

    if (!normalizedTokens.refresh_token) {
      return NextResponse.json(
        {
          ok: false,
          message:
            'Google não retornou refresh_token. Reautorize com access_type=offline e prompt=consent.',
        },
        { status: 400 }
      );
    }

    const persistence = await persistGoogleCredentialsToSupabase(normalizedTokens);

    return NextResponse.json({
      ok: true,
      message: 'Tokens obtidos com sucesso.',
      tokens: normalizedTokens,
      persistence,
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
