import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

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
  const params = await context.params;
  const userId = params?.id;

  console.info('[ADMIN_USERS][DELETE_START]', { userId });

  if (!userId) {
    console.error('[ADMIN_USERS][DELETE_ERROR]', { error: 'ID do usuário não informado.' });
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
      console.error('[ADMIN_USERS][DELETE_ERROR]', { userId, error: profileError.message });
      return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 });
    }

    if (!profile) {
      console.error('[ADMIN_USERS][DELETE_ERROR]', { userId, error: 'Usuário não encontrado.' });
      return NextResponse.json({ ok: false, error: 'Usuário não encontrado.' }, { status: 404 });
    }

    if (profile.role === 'admin') {
      const { count, error: countError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin');

      if (!countError && count <= 1) {
        console.error('[ADMIN_USERS][DELETE_ERROR]', {
          userId,
          error: 'Não é possível excluir o último administrador.',
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
      console.error('[ADMIN_USERS][DELETE_ERROR]', { userId, error: deleteProfileError.message });
      return NextResponse.json(
        { ok: false, error: deleteProfileError.message },
        { status: 500 }
      );
    }
    console.info('[ADMIN_USERS][DELETE_PROFILE_OK]', { userId });

    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      const msg = String(deleteAuthError.message || '').toLowerCase();

      const ignorable =
        msg.includes('user not found') ||
        msg.includes('not found') ||
        msg.includes('does not exist') ||
        isAuthUserMissing(deleteAuthError);

      if (!ignorable) {
        console.error('[ADMIN_USERS][DELETE_ERROR]', { userId, error: deleteAuthError.message });
        return NextResponse.json(
          {
            ok: false,
            error: `Profile excluído, mas houve erro ao remover Auth: ${deleteAuthError.message}`,
          },
          { status: 500 }
        );
      }

      console.info('[ADMIN_USERS][DELETE_AUTH_OK]', { userId, authAlreadyMissing: true });
    } else {
      console.info('[ADMIN_USERS][DELETE_AUTH_OK]', { userId });
    }

    return NextResponse.json({
      ok: true,
      deletedUserId: userId,
      deletedEmail: profile.email || null,
    });
  } catch (error) {
    console.error('[ADMIN_USERS][DELETE_ERROR]', {
      userId,
      error: error?.message || 'Erro interno ao excluir usuário.',
    });
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno ao excluir usuário.' },
      { status: 500 }
    );
  }
}
