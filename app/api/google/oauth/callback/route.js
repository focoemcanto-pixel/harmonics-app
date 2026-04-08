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
    const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
    const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
    const redirectUri = String(process.env.GOOGLE_OAUTH_REDIRECT_URI || '').trim();

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = String(searchParams.get('state') || '').trim();
    
    console.error('[CALLBACK] Iniciando callback OAuth');
    console.error('[CALLBACK] Parâmetros:', {
      hasCode: !!code,
      hasState: !!state,
    });

    // Validar code
    if (!code) {
      console.error('[CALLBACK] Code não recebido do Google');
      return NextResponse.json(
        { ok: false, message: 'Code não recebido do Google.' },
        { status: 400 }
      );
    }

    // Validar state
    const parsedState = verifySignedState(state);
    if (!parsedState.valid) {
      console.error('[CALLBACK] State inválido:', parsedState.reason);
      return NextResponse.json(
        { ok: false, message: `State inválido (${parsedState.reason})` },
        { status: 400 }
      );
    }

    const userIdFromState = String(parsedState.userId || '').trim();
    console.error('[CALLBACK] State válido para userId:', userIdFromState);

    // Validar autenticação Supabase
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    const authenticatedUserId = String(user?.id || '').trim();

    if (!authenticatedUserId || authError) {
      console.error('[CALLBACK] Usuário não autenticado:', authError?.message);
      return NextResponse.json(
        {
          ok: false,
          message: 'Usuário não autenticado no callback OAuth.',
          error: authError?.message,
        },
        { status: 401 }
      );
    }

    // Validar que o usuário do state corresponde ao usuário autenticado
    if (userIdFromState !== authenticatedUserId) {
      console.error('[CALLBACK] Mismatch de userId:', {
        fromState: userIdFromState,
        authenticated: authenticatedUserId,
      });
      return NextResponse.json(
        {
          ok: false,
          message: 'Usuário autenticado não corresponde ao usuário do state OAuth.',
        },
        { status: 403 }
      );
    }

    const userId = authenticatedUserId;
    console.error('[CALLBACK] userId validado:', userId);

    // Obter tokens do Google
    console.error('[CALLBACK] Chamando oauth2Client.getToken(code)...');
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    
    let tokenResponse;
    try {
      tokenResponse = await oauth2Client.getToken(code);
      console.error('[CALLBACK] getToken() sucesso');
    } catch (error) {
      console.error('[CALLBACK] getToken() falhou:', error.message);
      return NextResponse.json(
        {
          ok: false,
          message: 'Falha ao obter tokens do Google: ' + error.message,
        },
        { status: 400 }
      );
    }

    // Extrair tokens
    const tokens = extractOAuthTokensFromResponse(tokenResponse);

    console.error('[CALLBACK] Tokens extraído:', {
      type: typeof tokens,
      keys: tokens && typeof tokens === 'object' ? Object.keys(tokens) : [],
      hasAccessToken: !!tokens?.access_token,
      hasRefreshToken: !!tokens?.refresh_token,
    });

    if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) {
      console.error('[CALLBACK] Tokens inválido');
      return NextResponse.json(
        {
          ok: false,
          message: 'Payload de tokens inválido recebido do Google OAuth.',
        },
        { status: 400 }
      );
    }

    // Normalizar tokens (usar antigo se Google não retornar novo refresh_token)
    console.error('[CALLBACK] Normalizando tokens...');
    const normalizedTokens = await normalizeTokensWithPreviousRefreshToken(tokens, userId);

    console.error('[CALLBACK] Tokens normalizado:', {
      hasAccessToken: !!normalizedTokens?.access_token,
      hasRefreshToken: !!normalizedTokens?.refresh_token,
    });

    // Configurar credentials no OAuth2Client
    try {
      oauth2Client.setCredentials(normalizedTokens);
      console.error('[CALLBACK] setCredentials() sucesso');
    } catch (error) {
      console.error('[CALLBACK] setCredentials() falhou:', error.message);
      return NextResponse.json(
        {
          ok: false,
          message: 'Falha ao configurar credenciais: ' + error.message,
        },
        { status: 500 }
      );
    }

    // Validar tokens
    console.error('[CALLBACK] Validando tokens para storage...');
    const tokenValidation = validateGoogleOAuthTokensForStorage(normalizedTokens);

    if (!tokenValidation.valid) {
      console.error('[CALLBACK] Validação falhou:', tokenValidation.reason);
      return NextResponse.json(
        {
          ok: false,
          message: `Tokens OAuth inválidos (${tokenValidation.reason}): ${tokenValidation.message}`,
        },
        { status: 400 }
      );
    }

    console.error('[CALLBACK] Tokens validado com sucesso');

    // Persistir no banco
    console.error('[CALLBACK] Persistindo credenciais no Supabase...');
    const persistence = await persistGoogleCredentialsToSupabase(normalizedTokens, { userId });

    if (!persistence.persisted) {
      console.error('[CALLBACK] Persistência falhou:', persistence.reason);
      
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
        },
        { status: 500 }
      );
    }

    console.error('[CALLBACK] SUCCESS - Credenciais persistidas');

    // ✅ SUCESSO - Retornar JSON com redirect URL
    return NextResponse.json({
      ok: true,
      message: 'Tokens obtidos com sucesso. Redirecionando...',
      redirectUrl: '/contrato', // Mudar para onde você quer redirecionar
    });

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
