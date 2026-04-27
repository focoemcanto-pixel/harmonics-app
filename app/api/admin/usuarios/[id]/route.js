import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdminServer } from '@/lib/api/require-admin-server';
import { logError, logInfo } from '@/lib/observability/server-log';

function isAuthUserMissing(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();

  return (
    message.includes('user not found') ||
    message.includes('not found') ||
    code === 'user_not_found'
  );
}

export async function DELETE(request, context) {
  const adminGuard = await requireAdminServer(request);

  if (!adminGuard.ok) {
    return adminGuard.response;
  }
  const params = await context.params;
  const userId = params?.id;

  logInfo('ADMIN_USERS', 'DELETE_START', { userId });

  if (adminGuard.user.id === userId) {
    return NextResponse.json(
      { ok: false, error: 'Você não pode excluir o próprio usuário logado.' },
      { status: 400 }
    );
  }

  if (!userId) {
    logError('ADMIN_USERS', 'DELETE_ERROR', new Error('ID do usuário não informado.'), { userId });
    return NextResponse.json({ ok: false, error: 'ID do usuário não informado.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, name, role')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      logError('ADMIN_USERS', 'DELETE_ERROR', profileError, { userId });
      return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 });
    }

    if (!profile) {
      logError('ADMIN_USERS', 'DELETE_ERROR', new Error('Usuário não encontrado.'), { userId });
      return NextResponse.json({ ok: false, error: 'Usuário não encontrado.' }, { status: 404 });
    }

    if (profile.role === 'admin') {
      const { count, error: countError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin');

      if (!countError && count <= 1) {
        logError('ADMIN_USERS', 'DELETE_ERROR', new Error('Não é possível excluir o último administrador.'), {
          userId,
        });
        return NextResponse.json(
          {
            ok: false,
            error: 'Não é possível excluir o último administrador.',
          },
          { status: 400 }
        );
      }
    }

    const { error: deleteProfileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (deleteProfileError) {
      logError('ADMIN_USERS', 'DELETE_ERROR', deleteProfileError, { userId });
      return NextResponse.json(
        { ok: false, error: deleteProfileError.message },
        { status: 500 }
      );
    }
    logInfo('ADMIN_USERS', 'DELETE_PROFILE_OK', { userId });

    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      const msg = String(deleteAuthError.message || '').toLowerCase();

      const ignorable =
        msg.includes('user not found') ||
        msg.includes('not found') ||
        msg.includes('does not exist') ||
        isAuthUserMissing(deleteAuthError);

      if (!ignorable) {
        logError('ADMIN_USERS', 'DELETE_ERROR', deleteAuthError, { userId });
        return NextResponse.json(
          {
            ok: false,
            error: `Profile excluído, mas houve erro ao remover Auth: ${deleteAuthError.message}`,
          },
          { status: 500 }
        );
      }

      logInfo('ADMIN_USERS', 'DELETE_AUTH_OK', { userId, authAlreadyMissing: true });
    } else {
      logInfo('ADMIN_USERS', 'DELETE_AUTH_OK', { userId });
    }

    return NextResponse.json({
      ok: true,
      deletedUserId: userId,
      deletedEmail: profile.email || null,
    });
  } catch (error) {
    logError('ADMIN_USERS', 'DELETE_ERROR', error, { userId });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno ao excluir usuário.' },
      { status: 500 }
    );
  }
}
