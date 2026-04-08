import { NextResponse } from 'next/server.js';
import { google } from 'googleapis';
import crypto from 'node:crypto';
import {
  loadExistingGoogleRefreshTokenByUserId,
  markGoogleCredentialAsRevokedByUserId,
  persistGoogleCredentialsToSupabase,
  validateGoogleOAuthTokensForStorage,
} from '../../../../../lib/contracts/googleCredentials.js';

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

function safeKeys(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value)
    : [];
}

function maskToken(value) {
  const raw = String(value || '');
  if (!raw) return null;
  if (raw.length <= 12) return `${raw.slice(0, 4)}...`;
  return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
}

function serializeForLog(obj) {
  try {
    if (!obj || typeof obj !== 'object') return obj;

    const clone = JSON.parse(JSON.stringify(obj));

    const maskInObject = (target) => {
      if (!target || typeof target !== 'object') return;
      if (target.access_token) target.access_token = maskToken(target.access_token);
      if (target.refresh_token) target.refresh_token = maskToken(target.refresh_token);
      if (target.id_token) target.id_token = maskToken(target.id_token);
    };

    maskInObject(clone);
    maskInObject(clone.tokens);
    maskInObject(clone.res?.data);

    return clone;
  } catch {
    return '[unserializable]';
  }
}

function looksLikeTokenPayload(value) {
  return !!(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (
      value.access_token ||
      value.refresh_token ||
      value.id_token ||
      value.token_type ||
      value.expiry_date ||
      value.scope
    )
  );
}

/**
 * Faz unwrap recursivo da resposta do Google até achar o payload real dos tokens.
 */
function extractOAuthTokensFromResponse(tokenResponse) {
  let current = tokenResponse;
  const visited = new Set();

  for (let i = 0; i < 10; i += 1) {
    if (!current || typeof current !== 'object') return null;
    if (visited.has(current)) break;
    visited.add(current);

    if (looksLikeTokenPayload(current)) {
      return current;
    }

    if (
      current.tokens &&
      typeof current.tokens === 'object' &&
      !Array.isArray(current.tokens)
    ) {
      current = current.tokens;
      continue;
    }

    if (
      current.res?.data &&
      typeof current.res.data === 'object' &&
      !Array.isArray(current.res.data)
    ) {
      current = current.res.data;
      continue;
    }

    if (Array.isArray(current) && current.length > 0) {
      current = current[0];
      continue;
    }

    break;
  }

  return null;
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

export async function revokeToken(refreshToken, userId) {
  const oauth2Client = getOAuth2Client();

  try {
    if (refreshToken) {
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

    let tokenResponse;
    try {
      tokenResponse = await oauth2Client.getToken(code);
      console.error('[CALLBACK] getToken() executado com sucesso');
      console.error('[CALLBACK] tokenResponse type:', typeof tokenResponse);
      console.error('[CALLBACK] tokenResponse keys:', safeKeys(tokenResponse));
      console.error(
        '[CALLBACK] tokenResponse.tokens keys:',
        safeKeys(tokenResponse?.tokens)
      );
      console.error(
        '[CALLBACK] tokenResponse.res.data keys:',
        safeKeys(tokenResponse?.res?.data)
      );
      console.error(
        '[CALLBACK] tokenResponse masked:',
        serializeForLog(tokenResponse)
      );
    } catch (error) {
      console.error('[CALLBACK] getToken() falhou:', error.message);
      console.error(
        '[CALLBACK] getToken() response data:',
        serializeForLog(error?.response?.data)
      );

      return NextResponse.json(
        {
          ok: false,
          message: `Falha ao obter tokens do Google: ${error.message}`,
          debug: {
            responseData: serializeForLog(error?.response?.data),
          },
        },
        { status: 400 }
      );
    }

    const rawTokens = extractOAuthTokensFromResponse(tokenResponse);

    console.error('[CALLBACK] rawTokens keys:', safeKeys(rawTokens));
    console.error(
      '[CALLBACK] rawTokens masked:',
      serializeForLog(rawTokens)
    );

    if (!rawTokens || typeof rawTokens !== 'object' || Array.isArray(rawTokens)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Payload de tokens inválido recebido do Google OAuth.',
          debug: {
            hasTokenResponse: !!tokenResponse,
            hasTokensProperty: !!tokenResponse?.tokens,
            hasResData: !!tokenResponse?.res?.data,
            tokenResponseKeys: safeKeys(tokenResponse),
            tokenKeys: [],
          },
        },
        { status: 400 }
      );
    }

    const normalizedTokensBase = {
      access_token: String(rawTokens?.access_token || '').trim() || null,
      refresh_token: String(rawTokens?.refresh_token || '').trim() || null,
      scope: String(rawTokens?.scope || '').trim() || null,
      token_type: String(rawTokens?.token_type || 'Bearer').trim(),
      expiry_date: rawTokens?.expiry_date ?? null,
      id_token: String(rawTokens?.id_token || '').trim() || null,
    };

    console.error(
      '[CALLBACK] normalizedTokensBase:',
      serializeForLog(normalizedTokensBase)
    );

    if (!normalizedTokensBase.access_token) {
      return NextResponse.json(
        {
          ok: false,
          message: 'access_token ausente na resposta do Google OAuth',
          debug: {
            hasTokenResponse: !!tokenResponse,
            hasTokensProperty: !!tokenResponse?.tokens,
            hasResData: !!tokenResponse?.res?.data,
            tokenResponseKeys: safeKeys(tokenResponse),
            tokenKeys: safeKeys(rawTokens),
          },
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
    console.error(
      '[CALLBACK] normalizedTokens masked:',
      serializeForLog(normalizedTokens)
    );

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
      oauth2Client.setCredentials(normalizedTokens);
      console.error('[CALLBACK] setCredentials() sucesso');
    } catch (error) {
      console.error('[CALLBACK] setCredentials() falhou:', error.message);
      return NextResponse.json(
        {
          ok: false,
          message: `Falha ao configurar credenciais: ${error.message}`,
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
      new URL('/contrato?google_oauth=success', request.url)
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
