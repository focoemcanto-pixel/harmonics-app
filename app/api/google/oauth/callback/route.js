import { NextResponse } from 'next/server.js';
import { google } from 'googleapis';
import {
  loadExistingGoogleRefreshTokenByUserId,
  markGoogleCredentialAsRevokedByUserId,
  persistGoogleCredentialsToSupabase,
  validateGoogleOAuthTokensForStorage,
} from '../../../../../lib/contracts/googleCredentials.js';
import crypto from 'node:crypto';
import { createClient } from '@/lib/supabase/server';

const STATE_TTL_MS = 10 * 60 * 1000;

function getStateSecret() {
  return String(process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

function verifySignedState(state) {
  const normalizedState = String(state || '').trim();
  if (!normalizedState) return { valid: false, reason: 'state_missing' };

  const [nonce = '', encodedUserId = '', issuedAt = '', signature = ''] = normalizedState.split('.');
  if (!nonce || !encodedUserId || !issuedAt || !signature) {
    return { valid: false, reason: 'state_format_invalid' };
  }

  const stateSecret = getStateSecret();
  if (!stateSecret) return { valid: false, reason: 'state_secret_missing' };

  const payload = `${nonce}.${encodedUserId}.${issuedAt}`;
  const expectedSignature = crypto.createHmac('sha256', stateSecret).update(payload).digest('base64url');
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length) {
    return { valid: false, reason: 'state_signature_invalid' };
  }
  const signaturesMatch = crypto.timingSafeEqual(providedBuffer, expectedBuffer);

  if (!signaturesMatch) return { valid: false, reason: 'state_signature_invalid' };

  const issuedAtNumber = Number(issuedAt);
  if (!Number.isFinite(issuedAtNumber)) return { valid: false, reason: 'state_issued_at_invalid' };
  if (Date.now() - issuedAtNumber > STATE_TTL_MS) return { valid: false, reason: 'state_expired' };

  try {
    const userId = Buffer.from(encodedUserId, 'base64url').toString('utf8').trim();
    return { valid: Boolean(userId), reason: userId ? 'ok' : 'state_user_id_missing', userId };
  } catch {
    return { valid: false, reason: 'state_decode_failed' };
  }
}

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

async function normalizeTokensWithPreviousRefreshToken(tokens, userId) {
  const refreshToken = String(tokens?.refresh_token || '').trim();
  if (refreshToken) return tokens;

  const previousRefreshToken = await loadExistingGoogleRefreshTokenByUserId(userId);
  if (!previousRefreshToken) return tokens;

  return {
    ...tokens,
    refresh_token: previousRefreshToken,
  };
}

export async function revokeToken(refreshToken, userId) {
  const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
  const redirectUri = String(process.env.GOOGLE_OAUTH_REDIRECT_URI || '').trim();
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  try {
    if (refreshToken) {
      await oauth2Client.revokeToken(refreshToken);
      console.info('[google-oauth][revoke] token revogado no Google com sucesso.', {
        userId,
      });
    }

    const dbResult = await markGoogleCredentialAsRevokedByUserId(userId);
    if (!dbResult.updated) {
      console.error('[google-oauth][revoke] falha ao marcar credencial como revogada no banco.', {
        userId,
        dbResult,
      });
    }
    return dbResult;
  } catch (error) {
    console.error('[google-oauth][revoke] erro ao revogar token no Google.', {
      userId,
      error: error?.message || error,
    });
    throw error;
  }
}

export async function GET(request) {
  try {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = String(searchParams.get('state') || '').trim();
    const parsedState = verifySignedState(state);
    const userIdFromState = String(parsedState.userId || '').trim();

    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    const authenticatedUserId = String(user?.id || '').trim();

    console.info('[google-oauth][callback] callback recebido.', {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      stateValidation: parsedState.reason,
      userIdFromStatePresent: Boolean(userIdFromState),
      authenticatedUserPresent: Boolean(authenticatedUserId),
    });

    if (!code) {
      return NextResponse.json(
        { ok: false, message: 'Code não recebido do Google.' },
        { status: 400 }
      );
    }

    if (!authenticatedUserId || authError) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Usuário não autenticado no callback OAuth.',
          error: authError?.message,
        },
        { status: 401 }
      );
    }

    if (!parsedState.valid || !userIdFromState) {
      return NextResponse.json(
        { ok: false, message: `state inválido no callback OAuth (${parsedState.reason}).` },
        { status: 400 }
      );
    }

    if (userIdFromState !== authenticatedUserId) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Usuário autenticado não corresponde ao usuário do state OAuth.',
          diagnostics: {
            userIdFromState,
            authenticatedUserId,
          },
        },
        { status: 403 }
      );
    }

    const userId = authenticatedUserId;

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    const tokenResponse = await oauth2Client.getToken(code);
    const tokens = extractOAuthTokensFromResponse(tokenResponse);

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
      hasRefreshToken: Boolean(tokens?.refresh_token),
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

    const normalizedTokens = await normalizeTokensWithPreviousRefreshToken(tokens, userId);
    oauth2Client.setCredentials(normalizedTokens);
    console.log('Credenciais OAuth configuradas no oauth2Client.');

    if (normalizedTokens?.refresh_token) {
      console.log('Refresh Token disponível no callback OAuth.');
    } else {
      console.warn(
        '[google-oauth][callback] refresh_token ausente no retorno e sem token anterior para fallback.'
      );
    }

    const tokenValidation = validateGoogleOAuthTokensForStorage(normalizedTokens);

    if (!tokenValidation.valid) {
      return NextResponse.json(
        {
          ok: false,
          message: `Tokens OAuth inválidos (${tokenValidation.reason}): ${tokenValidation.message}`,
        },
        { status: 400 }
      );
    }

    const persistence = await persistGoogleCredentialsToSupabase(normalizedTokens, { userId });

    if (!persistence.persisted) {
      if (persistence.reason === 'unique_constraint_violation') {
        return NextResponse.json(
          {
            ok: false,
            message:
              'Conflito de credenciais por usuário (constraint única). Tente novamente com nova autorização.',
            persistence,
          },
          { status: 409 }
        );
      }

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
    console.error('[google-oauth][callback] erro interno ao concluir OAuth:', error);
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'Erro ao concluir OAuth Google.',
      },
      { status: 500 }
    );
  }
}
