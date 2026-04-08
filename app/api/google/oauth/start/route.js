import { NextResponse } from 'next/server.js';
import crypto from 'node:crypto';
import { createClient } from '@/lib/supabase/server';

const STATE_TTL_MS = 10 * 60 * 1000;

function getStateSecret() {
  return String(process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

function generateSignedState(userId) {
  try {
    console.error('[STATE-GENERATE] userId:', userId);

    if (!userId || typeof userId !== 'string') {
      throw new Error('userId inválido');
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const encodedUserId = Buffer.from(userId, 'utf8').toString('base64url');
    const issuedAt = Date.now().toString();
    const stateSecret = getStateSecret();

    if (!stateSecret) {
      throw new Error('OAUTH_STATE_SECRET não configurada');
    }

    const payload = `${nonce}.${encodedUserId}.${issuedAt}`;
    const signature = crypto
      .createHmac('sha256', stateSecret)
      .update(payload)
      .digest('base64url');

    const state = `${payload}.${signature}`;

    console.error('[STATE-GENERATE] SUCCESS:', {
      userId,
      state: state.substring(0, 30) + '...',
    });

    return state;
  } catch (error) {
    console.error('[STATE-GENERATE] FAILED:', error.message);
    throw error;
  }
}

function getOAuth2Client() {
  try {
    const { google } = require('googleapis');
    
    const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
    const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
    const redirectUri = String(process.env.GOOGLE_OAUTH_REDIRECT_URI || '').trim();

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Google OAuth env vars não configuradas');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  } catch (error) {
    console.error('[OAUTH2-CLIENT] FAILED:', error.message);
    throw error;
  }
}

export async function POST(request) {
  try {
    console.error('[START-OAUTH] Iniciando POST');

    // ✅ CORRIGIDO: Usar Supabase Auth para obter usuário autenticado
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    console.error('[START-OAUTH] Auth check:', {
      hasUser: !!user,
      userId: user?.id,
      authError: authError?.message,
    });

    if (!user || !user.id) {
      console.error('[START-OAUTH] Usuário não autenticado');
      return NextResponse.json(
        {
          ok: false,
          message: 'Usuário não autenticado',
          error: authError?.message || 'Auth session missing!',
        },
        { status: 401 }
      );
    }

    const userId = user.id;
    console.error('[START-OAUTH] Usuário autenticado:', userId);

    // Gerar state com segurança
    const state = generateSignedState(userId);

    // Gerar URL de autenticação
    const oauth2Client = getOAuth2Client();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/documents',
      ],
      state,
    });

    console.error('[START-OAUTH] SUCCESS - authUrl gerada');

    return NextResponse.json(
      {
        ok: true,
        message: 'URL de autenticação gerada com sucesso',
        authUrl,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[START-OAUTH] ERRO:', {
      message: error?.message,
      stack: error?.stack,
    });

    return NextResponse.json(
      {
        ok: false,
        message: 'Erro ao iniciar OAuth: ' + error?.message,
        error: error?.message,
      },
      { status: 500 }
    );
  }
}

// Também suporta GET
export async function GET(request) {
  return POST(request);
}
