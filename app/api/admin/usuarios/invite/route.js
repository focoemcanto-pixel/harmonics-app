import { NextResponse } from 'next/server';
import { sendAdminAccessInvite } from '@/lib/admin/admin-access-invite';
import { requireAdminServer } from '@/lib/api/require-admin-server';
import { logError, logInfo, maskEmail } from '@/lib/observability/server-log';
import { getRequestIp, getUserAgent } from '@/lib/api/request-meta';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { writeAuditLog } from '@/lib/audit/audit-log';
import { requireRequiredEnv } from '@/lib/config/validate-env';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function POST(request) {
  const adminGuard = await requireAdminServer(request);
  const requestIp = getRequestIp(request);
  const userAgent = getUserAgent(request);

  if (!adminGuard.ok) {
    return adminGuard.response;
  }

  try {
    requireRequiredEnv('admin/usuarios/invite');

    const body = await request.json();
    const email = normalizeEmail(body?.email);
    const rateLimitResult = checkRateLimit({
      key: `admin-invite:${adminGuard.user.id}:${email || 'email-na'}`,
      limit: 10,
      windowMs: 15 * 60 * 1000,
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

    logInfo('ADMIN_USERS_INVITE', 'START', { email: maskEmail(email) });
    const supabase = getSupabaseAdmin();

    const result = await sendAdminAccessInvite({ email });

    if (!result.ok) {
      await writeAuditLog({
        supabase,
        actorUserId: adminGuard.user.id,
        actorEmail: adminGuard.user.email || null,
        action: 'admin.user.invite_resend',
        entityType: 'profile',
        entityId: email,
        status: 'failed',
        ip: requestIp,
        userAgent,
        metadata: {
          email: maskEmail(email),
          provider: result.provider || 'resend',
          error: result.error || null,
        },
      });
      logError('ADMIN_USERS_INVITE', 'SEND_FAILED', new Error(result.error || 'Falha ao enviar convite'), {
        status: result.status || 500,
        email: maskEmail(email),
      });
      return NextResponse.json(
        { ok: false, error: result.error || 'Falha ao enviar convite.' },
        { status: result.status || 500 }
      );
    }

    await writeAuditLog({
      supabase,
      actorUserId: adminGuard.user.id,
      actorEmail: adminGuard.user.email || null,
      action: 'admin.user.invite_resend',
      entityType: 'profile',
      entityId: email,
      status: 'success',
      ip: requestIp,
      userAgent,
      metadata: {
        email: maskEmail(email),
        provider: result.provider || 'resend',
      },
    });

    const payload = {
      ok: true,
      inviteSent: Boolean(result.inviteSent),
      provider: result.provider || 'resend',
      email,
    };

    if (result.inviteError) {
      payload.inviteError = result.inviteError;
    }

    if (process.env.NODE_ENV === 'development' && result.inviteLink) {
      payload.inviteLink = result.inviteLink;
    }

    return NextResponse.json(payload);
  } catch (error) {
    try {
      const supabase = getSupabaseAdmin();
      await writeAuditLog({
        supabase,
        actorUserId: adminGuard.user?.id || null,
        actorEmail: adminGuard.user?.email || null,
        action: 'admin.user.invite_resend',
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
    logError('ADMIN_USERS_INVITE', 'ERROR', error);

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
