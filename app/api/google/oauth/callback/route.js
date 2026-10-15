import { NextResponse } from 'next/server.js';
import { google } from 'googleapis';
import crypto from 'node:crypto';
import {
  loadExistingGoogleRefreshTokenByUserId,
  markGoogleCredentialAsRevokedByUserId,
  persistGoogleCredentialsToSupabase,
  validateGoogleOAuthTokensForStorage,
} from '../../../../../lib/contracts/googleCredentials.js';
import {
  describeTokenPayloadShape,
  exchangeGoogleAuthorizationCode,
} from '../../../../../lib/google/oauth-token-exchange.js';

const STATE_TTL_MS = 10 * 60 * 1000;

function getStateSecret() {
  return String(
    process.env.GOOGLE_OAUTH_STATE_SECRET ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      ''
  ).trim();
}

function verifySignedState(state) {
  const normalizedState = String(state || '').trim();
  if (!normalizedState) {
    return { valid: false, reason: 'state_missing' };
  }

  const [nonce = '', encodedUserId = '', issuedAt = '', signature = ''] =
    normalizedState.split('.');

  if (!nonce || !encodedUserId || !issuedAt || !signature) {
    return { valid: false, reason: 'state_format_invalid' };
  }

  const stateSecret = getStateSecret();
  if (!stateSecret) {
    return { valid: false, reason: 'state_secret_missing' };
  }

  const payload = `${nonce}.${encodedUserId}.${issuedAt}`;
  const expectedSignature = crypto
    .createHmac('sha256', stateSecret)
    .update(payload)
    .digest('base64url');

  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length) {
    return { valid: false, reason: 'state_signature_invalid' };
  }

  const signaturesMatch = crypto.timingSafeEqual(
    providedBuffer,
    expectedBuffer
  );

  if (!signaturesMatch) {
    return { valid: false, reason: 'state_signature_invalid' };
  }

  const issuedAtNumber = Number(issuedAt);
  if (!Number.isFinite(issuedAtNumber)) {
    return { valid: false, reason: 'state_issued_at_invalid' };
  }

  if (Date.now() - issuedAtNumber > STATE_TTL_MS) {
    return { valid: false, reason: 'state_expired' };
  }

  try {
    const userId = Buffer.from(encodedUserId, 'base64url')
      .toString('utf8')
      .trim();

    if (!userId) {
      return { valid: false, reason: 'state_user_id_missing' };
    }

    return {
      valid: true,
      reason: 'ok',
      userId,
    };
  } catch {
    return { valid: false, reason: 'state_decode_failed' };
  }
}

function getOAuth2Client() {
  const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(
    process.env.GOOGLE_OAUTH_CLIENT_SECRET || ''
  ).trim();
  const redirectUri = String(
    process.env.GOOGLE_OAUTH_REDIRECT_URI || ''
  ).trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth env vars não configuradas');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

async function normalizeTokensWithPreviousRefreshToken(tokens, userId) {
  const refreshToken = String(tokens?.refresh_token || '').trim();
  if (refreshToken) return tokens;

  console.error(
    '[CALLBACK] refresh_token não veio do Google, buscando antigo...'
  );

  const previousRefreshToken =
    await loadExistingGoogleRefreshTokenByUserId(userId);

  if (!previousRefreshToken) {
    return tokens;
  }

  return {
    ...tokens,
    refresh_token: previousRefreshToken,
  };
}

function normalizeTokens(rawTokensCandidate) {
  const accessToken =
    typeof rawTokensCandidate?.access_token === 'string'
      ? rawTokensCandidate.access_token.trim()
      : null;

  const refreshToken =
    typeof rawTokensCandidate?.refresh_token === 'string'
      ? rawTokensCandidate.refresh_token.trim()
      : null;

  const scope =
    typeof rawTokensCandidate?.scope === 'string'
      ? rawTokensCandidate.scope.trim()
      : null;

  const tokenType =
    typeof rawTokensCandidate?.token_type === 'string'
      ? rawTokensCandidate.token_type.trim()
      : 'Bearer';

  const idToken =
    typeof rawTokensCandidate?.id_token === 'string'
      ? rawTokensCandidate.id_token.trim()
      : null;

  let expiryDate = rawTokensCandidate?.expiry_date ?? null;

  if (
    !expiryDate &&
    typeof rawTokensCandidate?.expires_in === 'number' &&
    Number.isFinite(rawTokensCandidate.expires_in)
  ) {
    expiryDate = Date.now() + rawTokensCandidate.expires_in * 1000;
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    scope,
    token_type: tokenType,
    expiry_date: expiryDate,
    id_token: idToken,
  };
}

export async function revokeToken(refreshToken, userId) {
  const oauth2Client = getOAuth2Client();

  try {
    if (refreshToken) {
      if (!oauth2Client.credentials || typeof oauth2Client.credentials !== 'object') {
        oauth2Client.credentials = {};
      }

      oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      await oauth2Client.revokeToken(refreshToken);
      console.info('[google-oauth][revoke] token revogado no Google.', {
        userId,
      });
    }

    const dbResult = await markGoogleCredentialAsRevokedByUserId(userId);

    if (!dbResult.updated) {
      console.error(
        '[google-oauth][revoke] falha ao marcar credencial como revogada no banco.',
        {
          userId,
          dbResult,
        }
      );
    }

    return dbResult;
  } catch (error) {
    console.error('[google-oauth][revoke] erro ao revogar token.', {
      userId,
      error: error?.message || error,
    });
    throw error;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = String(searchParams.get('code') || '').trim();
    const state = String(searchParams.get('state') || '').trim();
    const googleError = String(searchParams.get('error') || '').trim();

    console.error('[CALLBACK] Iniciando callback OAuth');
    console.error('[CALLBACK] code recebido:', !!code);
    console.error(
      '[CALLBACK] state recebido:',
      state ? `${state.slice(0, 40)}...` : ''
    );

    if (googleError) {
      console.error('[CALLBACK] Google retornou erro:', googleError);
      return NextResponse.json(
        {
          ok: false,
          message: `Google retornou erro: ${googleError}`,
        },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Code não recebido do Google.',
        },
        { status: 400 }
      );
    }

    const parsedState = verifySignedState(state);
    if (!parsedState.valid) {
      console.error('[CALLBACK] state inválido:', parsedState.reason);
      return NextResponse.json(
        {
          ok: false,
          message: `State inválido (${parsedState.reason})`,
        },
        { status: 400 }
      );
    }

    const userId = String(parsedState.userId || '').trim();
    console.error('[CALLBACK] userId extraído do state:', userId);

    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          message: 'user_id ausente no state do callback.',
        },
        { status: 400 }
      );
    }

    const oauth2Client = getOAuth2Client();

    let tokenPayload;
    try {
      tokenPayload = await exchangeGoogleAuthorizationCode({
        code,
        clientId: String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim(),
        clientSecret: String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim(),
        redirectUri: String(process.env.GOOGLE_OAUTH_REDIRECT_URI || '').trim(),
      });
      console.error(
        '[CALLBACK] troca do code concluída:',
        describeTokenPayloadShape(tokenPayload)
      );
    } catch (error) {
      console.error('[CALLBACK] troca do code falhou:', error?.message || error);

      return NextResponse.json(
        {
          ok: false,
          message: `Falha ao obter tokens do Google: ${
            error?.message || 'erro desconhecido'
          }`,
        },
        { status: 400 }
      );
    }

    const normalizedTokensBase = normalizeTokens(tokenPayload);

    console.error('[CALLBACK] normalizedTokensBase:', {
      hasAccessToken: !!normalizedTokensBase.access_token,
      hasRefreshToken: !!normalizedTokensBase.refresh_token,
      hasIdToken: !!normalizedTokensBase.id_token,
      token_type: normalizedTokensBase.token_type,
      scope: normalizedTokensBase.scope,
      expiry_date: normalizedTokensBase.expiry_date,
    });

    if (!normalizedTokensBase.access_token) {
      return NextResponse.json(
        {
          ok: false,
          message: 'access_token ausente na resposta do Google',
          debug: { tokenPayload: describeTokenPayloadShape(tokenPayload) },
        },
        { status: 400 }
      );
    }

    const normalizedTokens = await normalizeTokensWithPreviousRefreshToken(
      normalizedTokensBase,
      userId
    );

    console.error('[CALLBACK] tokens normalizados:', {
      hasAccessToken: !!normalizedTokens?.access_token,
      hasRefreshToken: !!normalizedTokens?.refresh_token,
    });

    const tokenValidation =
      validateGoogleOAuthTokensForStorage(normalizedTokens);

    if (!tokenValidation.valid) {
      console.error('[CALLBACK] validação de tokens falhou:', tokenValidation);
      return NextResponse.json(
        {
          ok: false,
          message: `Tokens OAuth inválidos (${tokenValidation.reason}): ${tokenValidation.message}`,
        },
        { status: 400 }
      );
    }

    if (!normalizedTokens.refresh_token) {
      return NextResponse.json(
        {
          ok: false,
          message:
            'Nenhum refresh_token disponível. Faça a autenticação novamente com prompt=consent.',
        },
        { status: 400 }
      );
    }

    try {
      console.error('[CALLBACK] antes do setCredentials:', {
        oauth2CredentialsType: typeof oauth2Client.credentials,
        oauth2CredentialsIsArray: Array.isArray(oauth2Client.credentials),
        normalizedTokensType: typeof normalizedTokens,
        normalizedTokensIsArray: Array.isArray(normalizedTokens),
        hasAccessToken: !!normalizedTokens?.access_token,
        hasRefreshToken: !!normalizedTokens?.refresh_token,
      });

      if (!oauth2Client.credentials || typeof oauth2Client.credentials !== 'object') {
        oauth2Client.credentials = {};
      }

      oauth2Client.setCredentials(normalizedTokens);

      console.error('[CALLBACK] depois do setCredentials:', {
        oauth2CredentialsType: typeof oauth2Client.credentials,
        oauth2CredentialsIsArray: Array.isArray(oauth2Client.credentials),
        hasAccessToken: !!oauth2Client?.credentials?.access_token,
        hasRefreshToken: !!oauth2Client?.credentials?.refresh_token,
      });

      console.error('[CALLBACK] setCredentials() sucesso');
    } catch (error) {
      console.error(
        '[CALLBACK] setCredentials() falhou:',
        error?.message || error
      );
      return NextResponse.json(
        {
          ok: false,
          message: `Falha ao configurar credenciais: ${
            error?.message || 'erro desconhecido'
          }`,
        },
        { status: 500 }
      );
    }

    const persistence = await persistGoogleCredentialsToSupabase(
      normalizedTokens,
      { userId }
    );

    if (!persistence.persisted) {
      console.error('[CALLBACK] persist failed:', persistence);

      if (persistence.reason === 'unique_constraint_violation') {
        return NextResponse.json(
          {
            ok: false,
            message: 'Credenciais já existem para este usuário.',
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

    console.error('[CALLBACK] persist success');

    return NextResponse.redirect(
      new URL('/contratos?google_oauth=success', request.url)
    );
  } catch (error) {
    console.error('[CALLBACK] ERRO CRÍTICO:', {
      message: error?.message,
      stack: error?.stack,
    });

    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'Erro ao concluir OAuth Google.',
      },
      { status: 500 }
    );
  }
}
