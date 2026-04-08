import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { google } from 'googleapis';
import {
  deactivateGoogleCredentials,
  getRevocableGoogleTokens,
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
    const tokenValidation = validateGoogleOAuthTokensForStorage(tokens);

    if (!tokenValidation.valid) {
      const revocableTokens = getRevocableGoogleTokens(tokens);
      for (const token of revocableTokens) {
        try {
          await oauth2Client.revokeToken(token);
        } catch (revokeError) {
          console.warn('[googleOAuthCallback] falha ao revogar token inválido:', {
            tokenSuffix: token.slice(-6),
            message: revokeError?.message,
          });
        }
      }

      await deactivateGoogleCredentials(`callback_invalid_tokens:${tokenValidation.reason}`);
      const state = crypto.randomBytes(24).toString('hex');
      const reauthUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: true,
        scope: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/documents',
        ],
        state,
      });

      return NextResponse.json(
        {
          ok: false,
          message: `Tokens OAuth inválidos (${tokenValidation.reason}): ${tokenValidation.message}`,
          reauthUrl,
          state,
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
