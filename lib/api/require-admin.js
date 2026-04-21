export async function requireAdminFromRequest({ supabase, request, logPrefix = '[ADMIN_GUARD]' }) {
  const authHeader = String(request?.headers?.get('authorization') || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return { ok: false, status: 401, error: 'Sessão inválida para executar exclusão.' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData?.user?.id) {
    console.warn(`${logPrefix}[AUTH_FAIL]`, { message: userError?.message || 'missing_user' });
    return { ok: false, status: 401, error: 'Sessão expirada. Faça login novamente.' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError) {
    console.warn(`${logPrefix}[PROFILE_FAIL]`, { message: profileError?.message });
    return { ok: false, status: 500, error: 'Falha ao validar perfil do usuário.' };
  }

  const role = String(profile?.role || '').toLowerCase();
  const isAdmin = profile?.is_admin === true || role === 'admin' || role === 'administrador';

  if (!isAdmin) {
    return { ok: false, status: 403, error: 'Apenas administradores podem excluir itens.' };
  }

  return { ok: true, userId: userData.user.id };
}
