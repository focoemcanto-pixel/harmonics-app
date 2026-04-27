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

export async function DELETE(request, { params }) {
  const userId = params?.id;

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'userId é obrigatório.' }, { status: 400 });
  }

  const requesterId = request.headers.get('x-requester-id');
  if (requesterId && requesterId === userId) {
    return NextResponse.json(
      { ok: false, error: 'Você não pode excluir o próprio usuário.' },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    const { error: profileDeleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileDeleteError) {
      return NextResponse.json(
        { ok: false, error: profileDeleteError.message || 'Erro ao excluir profile.' },
        { status: 500 }
      );
    }

    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);

    if (authDeleteError && !isAuthUserMissing(authDeleteError)) {
      return NextResponse.json(
        { ok: false, error: authDeleteError.message || 'Erro ao excluir usuário no Auth.' },
        { status: 500 }
      );
    }

    const authAlreadyMissing = !!authDeleteError && isAuthUserMissing(authDeleteError);

    return NextResponse.json({
      ok: true,
      message: authAlreadyMissing
        ? 'Profile removido e usuário já não existia no Auth.'
        : 'Usuário excluído com sucesso.',
      authAlreadyMissing,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno ao excluir usuário.' },
      { status: 500 }
    );
  }
}
