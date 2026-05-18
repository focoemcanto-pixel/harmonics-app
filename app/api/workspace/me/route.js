import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';

const ROLE_PERMISSIONS = {
  owner: { modules: ['dashboard', 'eventos', 'contatos', 'convites', 'escalas', 'contratos', 'repertorios', 'sugestoes', 'automacoes', 'avaliacoes', 'pagamentos', 'usuarios'], can_manage_team: true, can_manage_automations: true, can_manage_finance: true, can_manage_contracts: true },
  admin: { modules: ['dashboard', 'eventos', 'contatos', 'convites', 'escalas', 'contratos', 'repertorios', 'sugestoes', 'automacoes', 'avaliacoes', 'pagamentos', 'usuarios'], can_manage_team: true, can_manage_automations: true, can_manage_finance: true, can_manage_contracts: true },
  financeiro: { modules: ['dashboard', 'contratos', 'pagamentos', 'contatos'], can_manage_team: false, can_manage_automations: false, can_manage_finance: true, can_manage_contracts: true },
  operacional: { modules: ['dashboard', 'eventos', 'contatos', 'convites', 'escalas', 'repertorios', 'contratos'], can_manage_team: false, can_manage_automations: false, can_manage_finance: false, can_manage_contracts: false },
  editor: { modules: ['dashboard', 'eventos', 'contatos', 'repertorios', 'sugestoes'], can_manage_team: false, can_manage_automations: false, can_manage_finance: false, can_manage_contracts: false },
  viewer: { modules: ['dashboard', 'eventos', 'contatos', 'contratos', 'repertorios'], can_manage_team: false, can_manage_automations: false, can_manage_finance: false, can_manage_contracts: false },
};

function normalizeRole(value) {
  return String(value || 'viewer').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function getPermissions(role) {
  return ROLE_PERMISSIONS[normalizeRole(role)] || ROLE_PERMISSIONS.viewer;
}

function isMissingColumnError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  return code === '42703' || message.includes('does not exist') || message.includes('could not find') || details.includes('schema cache');
}

async function getProfileSafe({ supabase, userId }) {
  const attempts = ['id, email, name, role', 'id, email, role', 'id, role', 'id'];

  for (const fields of attempts) {
    const { data, error } = await supabase.from('profiles').select(fields).eq('id', userId).maybeSingle();
    if (!error) return data || null;
    if (!isMissingColumnError(error)) {
      console.warn('[WORKSPACE_ME][PROFILE_LOOKUP_ERROR]', { message: error?.message, code: error?.code });
      return null;
    }
  }

  return null;
}

export async function GET(request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const auth = await requireWorkspaceAccess({
      supabase: supabaseAdmin,
      request,
      logPrefix: '[WORKSPACE_ME][GET]',
    });

    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
    }

    const role = normalizeRole(auth.role);
    const permissions = getPermissions(role);
    const profile = await getProfileSafe({ supabase: supabaseAdmin, userId: auth.userId });

    return NextResponse.json({
      ok: true,
      user: {
        id: auth.userId,
        email: auth.email || profile?.email || null,
        name: profile?.name || null,
        global_role: profile?.role || null,
      },
      workspace: auth.workspace,
      member: auth.member,
      role,
      permissions,
    });
  } catch (error) {
    console.error('[GET /api/workspace/me] Erro:', { message: error?.message, code: error?.code, details: error?.details });
    return NextResponse.json({ ok: false, error: error?.message || 'Erro interno ao carregar permissões.' }, { status: 500 });
  }
}
