import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import {
  persistGoogleCredentialsToSupabase,
  validateGoogleOAuthTokensForStorage,
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
    console.log('Tokens recebidos:', tokens);

    if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Payload de tokens inválido recebido do Google OAuth.',
          diagnostics: {
            tokensType: typeof tokens,
            isArray: Array.isArray(tokens),
          },
        },
        { status: 400 }
      );
    }

    oauth2Client.setCredentials(tokens);
    console.log('Credenciais OAuth configuradas no oauth2Client.');

    if (tokens.refresh_token) {
      console.log('Refresh Token recebido no callback OAuth.');
    } else {
      console.error('Não foi possível obter o refresh_token no callback OAuth.');
    }

    const tokenValidation = validateGoogleOAuthTokensForStorage(tokens);

    if (!tokenValidation.valid) {
      return NextResponse.json(
        {
          ok: false,
          message: `Tokens OAuth inválidos (${tokenValidation.reason}): ${tokenValidation.message}`,
        },
        { status: 400 }
      );
    }

    const persistence = await persistGoogleCredentialsToSupabase(tokenValidation.credentials);

    if (!persistence.persisted) {
      return NextResponse.json(
        {
          ok: false,
          message: `Falha ao persistir credenciais: ${persistence.reason}`,
          persistence,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Tokens obtidos com sucesso.',
      tokens: tokenValidation.credentials,
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
