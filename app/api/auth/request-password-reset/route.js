import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendPasswordResetEmail } from '@/lib/email/sendPasswordResetEmail';
import { logError, logInfo, maskEmail } from '@/lib/observability/server-log';
import { requireRequiredEnv } from '@/lib/config/validate-env';
import { getRequestIp, getUserAgent } from '@/lib/api/request-meta';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { writeAuditLog } from '@/lib/audit/audit-log';

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
  const requestIp = getRequestIp(request);
  const userAgent = getUserAgent(request);
  try {
    requireRequiredEnv('auth/request-password-reset');

    const body = await request.json();
    const email = normalizeEmail(body?.email);
    const rateLimitResult = checkRateLimit({
      key: `auth-reset:${requestIp || 'ip-na'}:${email || 'email-na'}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    logInfo('AUTH_RESET', 'REQUEST_START', {
      hasEmail: Boolean(email),
      email: maskEmail(email),
    });

    if (!rateLimitResult.ok) {
      return NextResponse.json(
        { ok: false, error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimitResult.retryAfterSeconds || 60) },
        }
      );
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
    }

    logInfo('AUTH_RESET', 'ENV_CHECK', {
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

    logInfo('AUTH_RESET', 'PROFILE_CHECK', {
      hasProfile: Boolean(profile),
      ok: !profileError,
      email: maskEmail(email),
    });

    if (profileError) {
      throw new Error(profileError.message || 'Erro ao validar perfil do usuário.');
    }

    if (!profile) {
      await writeAuditLog({
        supabase,
        action: 'auth.password_reset.request',
        entityType: 'profile',
        entityId: email,
        status: 'success',
        ip: requestIp,
        userAgent,
        metadata: {
          profileFound: false,
          email: maskEmail(email),
        },
      });
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

    logInfo('AUTH_RESET', 'LINK_GENERATED', {
      ok: !linkError,
      hasLink: Boolean(linkData?.properties?.action_link),
      email: maskEmail(email),
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

    logInfo('AUTH_RESET', 'RESEND_SENT', {
      ok: emailResult.ok,
      emailId: emailResult.emailId || null,
      email: maskEmail(email),
    });

    if (!emailResult.ok) {
      await writeAuditLog({
        supabase,
        actorUserId: profile?.id || null,
        actorEmail: email,
        action: 'auth.password_reset.request',
        entityType: 'profile',
        entityId: profile?.id || null,
        status: 'failed',
        ip: requestIp,
        userAgent,
        metadata: {
          email: maskEmail(email),
          emailProviderOk: false,
        },
      });
      throw new Error(emailResult.error || 'Falha ao enviar e-mail de redefinição.');
    }

    await writeAuditLog({
      supabase,
      actorUserId: profile?.id || null,
      actorEmail: email,
      action: 'auth.password_reset.request',
      entityType: 'profile',
      entityId: profile?.id || null,
      status: 'success',
      ip: requestIp,
      userAgent,
      metadata: {
        profileFound: true,
        email: maskEmail(email),
        emailSent: true,
      },
    });

    return NextResponse.json({ ok: true, emailSent: true });
  } catch (error) {
    try {
      const supabase = getSupabaseAdmin();
      await writeAuditLog({
        supabase,
        action: 'auth.password_reset.request',
        entityType: 'profile',
        status: 'failed',
        ip: requestIp,
        userAgent,
        metadata: {
          error: error?.message || 'Erro interno do servidor',
        },
      });
    } catch {
      // no-op: auditoria é best effort
    }
    logError('AUTH_RESET', 'ERROR', error);

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
