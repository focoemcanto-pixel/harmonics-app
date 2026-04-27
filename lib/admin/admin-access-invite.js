import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendAccessInviteEmail } from '@/lib/email/sendAccessInviteEmail';

const FALLBACK_APP_BASE_URL = 'https://app.bandaharmonics.com';

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

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return {
      ok: false,
      status: 400,
      error: 'Informe um e-mail válido.',
    };
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

  const isDevelopment = process.env.NODE_ENV === 'development';

  if (!emailResult.ok) {
    if (emailResult.code === 'EMAIL_NOT_CONFIGURED') {
      if (isDevelopment) {
        return {
          ok: true,
          inviteSent: false,
          inviteError: emailResult.error,
          inviteLink,
        };
      }

      return {
        ok: false,
        status: 500,
        error: 'Serviço de e-mail não configurado.',
      };
    }

    return {
      ok: false,
      status: 500,
      error: emailResult.error || 'Falha ao enviar convite por e-mail.',
    };
  }

  return {
    ok: true,
    inviteSent: true,
    emailId: emailResult.emailId,
  };
}
