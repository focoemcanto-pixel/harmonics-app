import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import {
  persistGoogleCredentialsToSupabase,
  validateGoogleOAuthTokensForStorage,
} from '@/lib/contracts/googleCredentials';

function extractOAuthTokensFromResponse(tokenResponse) {
  if (!tokenResponse) return null;

  if (
    tokenResponse.tokens &&
    typeof tokenResponse.tokens === 'object' &&
    !Array.isArray(tokenResponse.tokens)
  ) {
    return tokenResponse.tokens;
  }

  if (typeof tokenResponse === 'object' && !Array.isArray(tokenResponse)) {
    return tokenResponse;
  }

  return null;
}

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

    const tokenResponse = await oauth2Client.getToken(code);
    const tokens = extractOAuthTokensFromResponse(tokenResponse);
    const refreshToken = String(tokens?.refresh_token || '').trim();

    console.info('[google-oauth][callback] retorno bruto getToken(code):', {
      responseType: typeof tokenResponse,
      responseKeys:
        tokenResponse && typeof tokenResponse === 'object' ? Object.keys(tokenResponse) : [],
      hasTokensProperty: Boolean(tokenResponse?.tokens),
      tokensType: typeof tokenResponse?.tokens,
      tokensIsArray: Array.isArray(tokenResponse?.tokens),
      extractedTokensType: typeof tokens,
      extractedTokenKeys: tokens && typeof tokens === 'object' ? Object.keys(tokens) : [],
      hasAccessToken: Boolean(tokens?.access_token),
      hasRefreshToken: Boolean(refreshToken),
      codeLength: String(code || '').length,
    });

    if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Payload de tokens inválido recebido do Google OAuth.',
          diagnostics: {
            tokenResponseType: typeof tokenResponse,
            tokenResponseKeys:
              tokenResponse && typeof tokenResponse === 'object'
                ? Object.keys(tokenResponse)
                : [],
            tokensType: typeof tokens,
            isArray: Array.isArray(tokens),
          },
        },
        { status: 400 }
      );
    }

    oauth2Client.setCredentials(tokens);
    console.log('Credenciais OAuth configuradas no oauth2Client.');

    if (refreshToken) {
      console.log('Refresh Token recebido no callback OAuth.');
    } else {
      console.warn(
        '[google-oauth][callback] refresh_token ausente no retorno. Para receber novamente, refaça o consentimento com prompt=consent e revogue o acesso anterior.'
      );
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
