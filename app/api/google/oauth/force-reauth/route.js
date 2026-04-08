import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import {
  deactivateGoogleCredentials,
  loadGoogleCredentialsFromSupabase,
  validateGoogleCredentials,
} from '@/lib/contracts/googleCredentials';

function buildOAuthClient() {
  const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
  const redirectUri = String(process.env.GOOGLE_OAUTH_REDIRECT_URI || '').trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Configuração OAuth incompleta (client_id, client_secret ou redirect_uri).');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function POST() {
  try {
    const envValidation = validateGoogleCredentials(process.env.GOOGLE_OAUTH_REFRESH_TOKEN);
    const { validation: supabaseValidation } = await loadGoogleCredentialsFromSupabase();

    const chosenValidation = envValidation.valid ? envValidation : supabaseValidation;

    if (chosenValidation.valid) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Credenciais atuais estão válidas. Reautenticação forçada não é necessária.',
        },
        { status: 409 }
      );
    }

    const revokeResult = await deactivateGoogleCredentials(`forced_reauth:${chosenValidation.reason}`);
    const oauth2Client = buildOAuthClient();
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

    return NextResponse.json({
      ok: true,
      message: 'Credenciais inválidas detectadas. Reautenticação necessária.',
      validation: {
        reason: chosenValidation.reason,
        message: chosenValidation.message,
      },
      revokeResult,
      reauthUrl,
      state,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'Erro ao iniciar reautenticação segura.',
      },
      { status: 500 }
    );
  }
}
