function normalizeRole(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function resolveAdminFromProfile(profile) {
  const role = normalizeRole(profile?.role);
  const isAdmin = profile?.is_admin === true || role === 'admin' || role === 'administrador';
  return { role, isAdmin };
}

export async function requireAdminFromRequest({ supabase, request, logPrefix = '[ADMIN_GUARD]' }) {
  console.info(`${logPrefix}[DELETE_AUTH][START]`);

  const authHeader = String(request?.headers?.get('authorization') || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    console.warn(`${logPrefix}[DELETE_AUTH][USER]`, { message: 'missing_bearer_token' });
    return { ok: false, status: 401, error: 'Sessão inválida para executar exclusão.' };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData?.user?.id) {
    console.warn(`${logPrefix}[DELETE_AUTH][USER]`, { message: userError?.message || 'missing_user' });
    return { ok: false, status: 401, error: 'Sessão expirada. Faça login novamente.' };
  }

  const userId = userData.user.id;
  console.info(`${logPrefix}[DELETE_AUTH][USER]`, { userId });

  let profile = null;
  const { data: profileWithIsAdmin, error: profileError } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    const missingIsAdminColumn = profileError?.code === '42703' || String(profileError?.message || '').includes('is_admin');

    if (!missingIsAdminColumn) {
      console.error(`${logPrefix}[DELETE_AUTH][PROFILE]`, {
        message: profileError?.message,
        code: profileError?.code,
        details: profileError?.details,
      });
      return { ok: false, status: 500, error: 'Falha ao validar perfil do usuário.' };
    }

    console.warn(`${logPrefix}[DELETE_AUTH][PROFILE]`, {
      message: 'is_admin_column_missing_fallback_to_role',
      originalMessage: profileError?.message,
    });

    const { data: fallbackProfile, error: fallbackError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (fallbackError) {
      console.error(`${logPrefix}[DELETE_AUTH][PROFILE]`, {
        message: fallbackError?.message,
        code: fallbackError?.code,
        details: fallbackError?.details,
      });
      return { ok: false, status: 500, error: 'Falha ao validar perfil do usuário.' };
    }

    profile = fallbackProfile || null;
  } else {
    profile = profileWithIsAdmin || null;
  }

  console.info(`${logPrefix}[DELETE_AUTH][PROFILE]`, {
    found: Boolean(profile),
    hasIsAdmin: Object.prototype.hasOwnProperty.call(profile || {}, 'is_admin'),
  });

  const { role, isAdmin } = resolveAdminFromProfile(profile);
  console.info(`${logPrefix}[DELETE_AUTH][ROLE]`, { role, isAdminFlag: profile?.is_admin === true, isAdmin });

  if (!isAdmin) {
    return { ok: false, status: 403, error: 'Apenas administradores podem excluir itens.' };
  }

  console.info(`${logPrefix}[DELETE_AUTH][AUTHORIZED]`, { userId });
  return { ok: true, userId, role };
}
