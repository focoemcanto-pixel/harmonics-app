import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendAccessInviteEmail } from '@/lib/email/sendAccessInviteEmail';

const FALLBACK_APP_BASE_URL = 'https://app.bandaharmonics.com';
const PROFESSIONAL_EMAIL_NOT_CONFIGURED = 'Serviço de e-mail profissional não configurado.';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    FALLBACK_APP_BASE_URL
  ).replace(/\/$/, '');
}

export async function sendAdminAccessInvite({ email }) {
  const normalizedEmail = normalizeEmail(email);
  const hasResendApiKey = Boolean(process.env.RESEND_API_KEY);
  const hasResendFromEmail = Boolean(process.env.RESEND_FROM_EMAIL);
  const hasAppBaseUrlEnv = Boolean(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL);

  console.info('[ADMIN_INVITE][RESEND_CONFIG]', {
    hasResendApiKey,
    hasResendFromEmail,
    hasAppBaseUrlEnv,
    appBaseUrlSource: process.env.NEXT_PUBLIC_APP_URL ? 'NEXT_PUBLIC_APP_URL' : process.env.APP_BASE_URL ? 'APP_BASE_URL' : 'fallback',
  });

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return {
      ok: false,
      status: 400,
      error: 'Informe um e-mail válido.',
    };
  }

  if (!hasResendApiKey || !hasResendFromEmail) {
    return {
      ok: false,
      status: 500,
      inviteSent: false,
      provider: 'resend',
      error: PROFESSIONAL_EMAIL_NOT_CONFIGURED,
    };
  }

  if (!hasAppBaseUrlEnv) {
    console.warn('[ADMIN_INVITE][APP_BASE_URL_MISSING]', {
      message: 'NEXT_PUBLIC_APP_URL ou APP_BASE_URL não configurados. Usando fallback.',
      fallback: FALLBACK_APP_BASE_URL,
    });
  }

  const supabase = getSupabaseAdmin();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, role, name')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false,
      status: 500,
      error: profileError.message || 'Erro ao validar perfil do usuário.',
    };
  }

  if (!profile || profile.role !== 'admin') {
    return {
      ok: false,
      status: 404,
      error: 'Administrador não encontrado para este e-mail.',
    };
  }

  const appBaseUrl = getAppBaseUrl();
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: normalizedEmail,
    options: {
      redirectTo: `${appBaseUrl}/auth/reset-password`,
    },
  });

  if (linkError) {
    return {
      ok: false,
      status: 500,
      error: linkError.message || 'Não foi possível gerar o convite de acesso.',
    };
  }

  const inviteLink = linkData?.properties?.action_link || null;
  console.info('[ADMIN_INVITE][LINK_GENERATED]', {
    email: normalizedEmail,
    hasLink: Boolean(inviteLink),
  });

  if (!inviteLink) {
    return {
      ok: false,
      status: 500,
      error: 'Link de convite não retornado pelo Supabase.',
    };
  }

  const emailResult = await sendAccessInviteEmail({
    to: normalizedEmail,
    inviteLink,
  });

  if (!emailResult.ok) {
    return {
      ok: false,
      status: 500,
      inviteSent: false,
      provider: 'resend',
      error: emailResult.error || 'Falha ao enviar convite por e-mail.',
    };
  }

  console.info('[ADMIN_INVITE][EMAIL_SENT]', {
    email: normalizedEmail,
    provider: 'resend',
    emailId: emailResult.emailId || null,
  });

  return {
    ok: true,
    inviteSent: true,
    provider: 'resend',
    emailId: emailResult.emailId,
  };
}
