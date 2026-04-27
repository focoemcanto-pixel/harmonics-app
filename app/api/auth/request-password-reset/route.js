import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendPasswordResetEmail } from '@/lib/email/sendPasswordResetEmail';

const FALLBACK_APP_BASE_URL = 'https://app.bandaharmonics.com';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    FALLBACK_APP_BASE_URL
  ).replace(/\/$/, '');
}

export async function POST(request) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body?.email);

    console.info('[AUTH_RESET][REQUEST_START]', {
      hasEmail: Boolean(email),
    });

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
    }

    console.info('[AUTH_RESET][ENV_CHECK]', {
      hasResendApiKey: Boolean(process.env.RESEND_API_KEY),
      hasResendFromEmail: Boolean(process.env.RESEND_FROM_EMAIL),
      hasSupabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    });

    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Serviço de e-mail não configurado corretamente.' },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    console.info('[AUTH_RESET][PROFILE_CHECK]', {
      hasProfile: Boolean(profile),
      ok: !profileError,
    });

    if (profileError) {
      throw new Error(profileError.message || 'Erro ao validar perfil do usuário.');
    }

    if (!profile) {
      return NextResponse.json({
        ok: true,
        emailSent: true,
        message: 'Se o e-mail existir em nossa base, enviaremos as instruções de redefinição.',
      });
    }

    const appBaseUrl = getAppBaseUrl();
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${appBaseUrl}/auth/reset-password`,
      },
    });

    console.info('[AUTH_RESET][LINK_GENERATED]', {
      ok: !linkError,
      hasLink: Boolean(linkData?.properties?.action_link),
    });

    if (linkError) {
      throw new Error(linkError.message || 'Não foi possível gerar link de redefinição.');
    }

    const resetLink = linkData?.properties?.action_link;

    if (!resetLink) {
      throw new Error('Link de redefinição não retornado pelo Supabase.');
    }

    const emailResult = await sendPasswordResetEmail({
      to: email,
      resetLink,
    });

    console.info('[AUTH_RESET][RESEND_SENT]', {
      ok: emailResult.ok,
      emailId: emailResult.emailId || null,
    });

    if (!emailResult.ok) {
      throw new Error(emailResult.error || 'Falha ao enviar e-mail de redefinição.');
    }

    return NextResponse.json({ ok: true, emailSent: true });
  } catch (error) {
    console.error('[AUTH_RESET][ERROR]', {
      message: error?.message || 'Erro interno do servidor',
      stack: error?.stack || null,
    });

    return NextResponse.json(
      { error: error?.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
