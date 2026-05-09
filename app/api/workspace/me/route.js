import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';

const ROLE_PERMISSIONS = {
  owner: {
    modules: ['dashboard', 'eventos', 'contatos', 'convites', 'escalas', 'contratos', 'repertorios', 'sugestoes', 'automacoes', 'avaliacoes', 'pagamentos', 'usuarios'],
    can_manage_team: true,
    can_manage_automations: true,
    can_manage_finance: true,
    can_manage_contracts: true,
  },
  admin: {
    modules: ['dashboard', 'eventos', 'contatos', 'convites', 'escalas', 'contratos', 'repertorios', 'sugestoes', 'automacoes', 'avaliacoes', 'pagamentos', 'usuarios'],
    can_manage_team: true,
    can_manage_automations: true,
    can_manage_finance: true,
    can_manage_contracts: true,
  },
  financeiro: {
    modules: ['dashboard', 'contratos', 'pagamentos', 'contatos'],
    can_manage_team: false,
    can_manage_automations: false,
    can_manage_finance: true,
    can_manage_contracts: true,
  },
  operacional: {
    modules: ['dashboard', 'eventos', 'contatos', 'convites', 'escalas', 'repertorios', 'contratos'],
    can_manage_team: false,
    can_manage_automations: false,
    can_manage_finance: false,
    can_manage_contracts: false,
  },
  editor: {
    modules: ['dashboard', 'eventos', 'contatos', 'repertorios', 'sugestoes'],
    can_manage_team: false,
    can_manage_automations: false,
    can_manage_finance: false,
    can_manage_contracts: false,
  },
  viewer: {
    modules: ['dashboard', 'eventos', 'contatos', 'contratos', 'repertorios'],
    can_manage_team: false,
    can_manage_automations: false,
    can_manage_finance: false,
    can_manage_contracts: false,
  },
};

function normalizeRole(value) {
  return String(value || 'viewer')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function getPermissions(role) {
  const normalizedRole = normalizeRole(role);
  return ROLE_PERMISSIONS[normalizedRole] || ROLE_PERMISSIONS.viewer;
}

export async function GET(request) {
  const supabaseAdmin = getSupabaseAdmin();
  const auth = await requireWorkspaceAccess({
    supabase: supabaseAdmin,
    request,
    logPrefix: '[WORKSPACE_ME][GET]',
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const role = normalizeRole(auth.role);
    const permissions = getPermissions(role);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, name, role')
      .eq('id', auth.userId)
      .maybeSingle();

    if (profileError) throw profileError;

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
    console.error('[GET /api/workspace/me] Erro:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno ao carregar permissões.' },
      { status: 500 }
    );
  }
}
