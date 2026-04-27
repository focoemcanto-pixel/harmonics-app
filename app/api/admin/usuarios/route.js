import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendAdminAccessInvite } from '@/lib/admin/admin-access-invite';
import { requireAdminServer } from '@/lib/api/require-admin-server';
import { requireRequiredEnv } from '@/lib/config/validate-env';
import { logError, logInfo, logWarn, maskEmail } from '@/lib/observability/server-log';
import { getRequestIp, getUserAgent } from '@/lib/api/request-meta';
import { writeAuditLog } from '@/lib/audit/audit-log';

const CANONICAL_ROLES = new Set(['admin', 'member']);

function normalizeRoleValue(value) {
  const role = String(value || '').trim().toLowerCase();

  if (role === 'administrador') return 'admin';
  if (role === 'membro') return 'member';
  if (CANONICAL_ROLES.has(role)) return role;

  return 'member';
}

function normalizeEmailValue(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeNameValue(value) {
  return String(value || '').trim();
}

function isDuplicateAuthUserError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('already been registered') || message.includes('already registered');
}

function isProfileDuplicateError(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();

  return (
    message.includes('duplicate key value') ||
    message.includes('profiles_pkey') ||
    message.includes('profiles_email_key') ||
    code === '23505'
  );
}

async function findAuthUserByEmail(supabase, email) {
  let page = 1;
  const perPage = 1000;

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      return { user: null, error };
    }

    const users = data?.users || [];
    const match = users.find(
      (candidate) => normalizeEmailValue(candidate?.email) === normalizeEmailValue(email)
    );

    if (match) {
      return { user: match, error: null };
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  return { user: null, error: null };
}

export async function POST(request) {
  const adminGuard = await requireAdminServer(request);
  const requestIp = getRequestIp(request);
  const userAgent = getUserAgent(request);

  if (!adminGuard.ok) {
    return adminGuard.response;
  }

  try {
    requireRequiredEnv('admin/usuarios');

    const body = await request.json();
    const { email, name, role } = body;

    if (!email || !name || !role) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: email, name, role' },
        { status: 400 }
      );
    }

    const normalizedRole = normalizeRoleValue(role);
    const normalizedEmail = normalizeEmailValue(email);
    const normalizedName = normalizeNameValue(name);

    logInfo('ADMIN_USERS', 'CREATE_START', {
      email: maskEmail(normalizedEmail),
      name: normalizedName,
      requestedRole: role,
      normalizedRole,
    });

    const supabase = getSupabaseAdmin();

    let userId = null;
    let authUserExisted = false;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
      user_metadata: {
        name: normalizedName,
        role: normalizedRole,
        access_type: normalizedRole,
        profile_type: normalizedRole,
        user_type: normalizedRole,
        is_admin: normalizedRole === 'admin',
      },
    });

    if (authError) {
      logInfo('ADMIN_USERS', 'AUTH_CREATE_RESULT', {
        ok: false,
        message: authError.message,
        code: authError.code || null,
        email: maskEmail(normalizedEmail),
      });

      if (!isDuplicateAuthUserError(authError)) {
        return NextResponse.json(
          { error: authError.message || 'Erro ao criar usuário no Auth.' },
          { status: 400 }
        );
      }

      const { user: existingUser, error: lookupError } = await findAuthUserByEmail(
        supabase,
        normalizedEmail
      );

      if (lookupError) {
        return NextResponse.json(
          { error: lookupError.message || 'Erro ao localizar usuário existente no Auth.' },
          { status: 500 }
        );
      }

      if (!existingUser?.id) {
        return NextResponse.json(
          { error: 'Já existe um usuário cadastrado com este email.' },
          { status: 409 }
        );
      }

      authUserExisted = true;
      userId = existingUser.id;
    } else {
      userId = authData?.user?.id || null;
      logInfo('ADMIN_USERS', 'AUTH_CREATE_RESULT', {
        ok: true,
        created: true,
        userId,
      });
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'ID de usuário não retornado.' },
        { status: 500 }
      );
    }

    const { data: existingProfile, error: existingProfileError } = await supabase
      .from('profiles')
      .select('id, email, role, name')
      .eq('id', userId)
      .maybeSingle();

    if (existingProfileError) {
      return NextResponse.json(
        { error: existingProfileError.message || 'Erro ao verificar perfil existente.' },
        { status: 500 }
      );
    }

    logInfo('ADMIN_USERS', 'PROFILE_BEFORE_SYNC', {
      userId,
      profileExists: !!existingProfile,
      existingRole: existingProfile?.role || null,
      existingEmail: maskEmail(existingProfile?.email || ''),
    });

    const profileSyncAction = existingProfile ? 'update_existing_profile' : 'upsert_profile';
    logInfo('ADMIN_USERS', 'PROFILE_SYNC_ACTION', {
      userId,
      action: profileSyncAction,
      authUserExisted,
    });

    const { data: syncedProfile, error: profileSyncError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          email: normalizedEmail,
          name: normalizedName,
          role: normalizedRole,
        },
        { onConflict: 'id' }
      )
      .select('id, email, role, name')
      .single();

    if (profileSyncError) {
      logInfo('ADMIN_USERS', 'PROFILE_SYNC_RESULT', {
        ok: false,
        userId,
        message: profileSyncError.message,
        code: profileSyncError.code || null,
      });

      if (isProfileDuplicateError(profileSyncError)) {
        return NextResponse.json(
          { error: 'Este usuário já possui perfil configurado.' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: profileSyncError.message || 'Erro ao sincronizar perfil do usuário.' },
        { status: 500 }
      );
    }

    logInfo('ADMIN_USERS', 'PROFILE_SYNC_RESULT', {
      ok: true,
      userId,
      profileRole: syncedProfile?.role || normalizedRole,
      authUserExisted,
    });

    let inviteSent = false;
    let inviteError = null;
    let inviteProvider = null;

    if (normalizedRole === 'admin') {
      logInfo('ADMIN_USERS', 'INVITE_AUTO_START', { email: maskEmail(normalizedEmail), userId });
      const inviteResult = await sendAdminAccessInvite({ email: normalizedEmail });
      inviteProvider = inviteResult.provider || 'resend';

      if (inviteResult.ok) {
        inviteSent = true;
        logInfo('ADMIN_USERS', 'INVITE_AUTO_RESULT', {
          ok: true,
          email: maskEmail(normalizedEmail),
          userId,
          provider: inviteProvider,
        });
      } else {
        inviteError = inviteResult.error || 'Falha ao enviar convite.';
        logWarn('ADMIN_USERS', 'INVITE_AUTO_RESULT', {
          ok: false,
          email: maskEmail(normalizedEmail),
          userId,
          provider: inviteProvider,
          error: inviteError,
        });
      }
    }

    await writeAuditLog({
      supabase,
      actorUserId: adminGuard.user.id,
      actorEmail: adminGuard.user.email || null,
      action: 'admin.user.create',
      entityType: 'profile',
      entityId: userId,
      status: 'success',
      ip: requestIp,
      userAgent,
      metadata: {
        createdRole: normalizedRole,
        authUserExisted,
        inviteSent,
        inviteError: inviteError ? String(inviteError).slice(0, 180) : null,
        email: maskEmail(normalizedEmail),
      },
    });

    return NextResponse.json({
      ok: true,
      userId,
      authUserExisted,
      inviteSent,
      ...(inviteProvider ? { provider: inviteProvider } : {}),
      ...(inviteError ? { inviteError } : {}),
    });
  } catch (error) {
    try {
      const supabase = getSupabaseAdmin();
      await writeAuditLog({
        supabase,
        actorUserId: adminGuard.user?.id || null,
        actorEmail: adminGuard.user?.email || null,
        action: 'admin.user.create',
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
    logError('ADMIN_USERS', 'CREATE_ERROR', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
