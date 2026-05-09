import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';

const ALLOWED_ROLES = new Set(['owner', 'admin', 'financeiro', 'operacional', 'editor', 'viewer']);

function normalizeRole(value) {
  const role = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  return ALLOWED_ROLES.has(role) ? role : null;
}

function normalizeStatus(value) {
  const status = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  if (['active', 'inactive', 'suspended'].includes(status)) return status;
  return null;
}

async function getMemberOrError({ supabaseAdmin, workspaceId, memberId }) {
  const { data: member, error } = await supabaseAdmin
    .from('workspace_members')
    .select('id, workspace_id, user_id, role, status')
    .eq('id', memberId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) throw error;

  if (!member?.id) {
    return { ok: false, status: 404, error: 'Membro não encontrado.' };
  }

  return { ok: true, member };
}

async function countActiveOwners({ supabaseAdmin, workspaceId }) {
  const { count, error } = await supabaseAdmin
    .from('workspace_members')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .eq('role', 'owner');

  if (error) throw error;
  return Number(count || 0);
}

async function wouldRemoveLastOwner({ supabaseAdmin, workspaceId, targetMember, nextRole = null, nextStatus = null }) {
  if (String(targetMember?.role || '').toLowerCase() !== 'owner') return false;
  if (String(targetMember?.status || '').toLowerCase() !== 'active') return false;

  const roleAfter = nextRole || targetMember.role;
  const statusAfter = nextStatus || targetMember.status;
  const staysActiveOwner =
    String(roleAfter || '').toLowerCase() === 'owner' &&
    String(statusAfter || '').toLowerCase() === 'active';

  if (staysActiveOwner) return false;

  const owners = await countActiveOwners({ supabaseAdmin, workspaceId });
  return owners <= 1;
}

export async function PATCH(request, context) {
  const supabaseAdmin = getSupabaseAdmin();
  const auth = await requireWorkspaceAdmin({
    supabase: supabaseAdmin,
    request,
    logPrefix: '[WORKSPACE_TEAM_MEMBER][PATCH]',
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const memberId = String(context?.params?.memberId || '').trim();
    if (!memberId) {
      return NextResponse.json({ ok: false, error: 'memberId obrigatório.' }, { status: 400 });
    }

    const lookup = await getMemberOrError({ supabaseAdmin, workspaceId: auth.workspaceId, memberId });
    if (!lookup.ok) {
      return NextResponse.json({ ok: false, error: lookup.error }, { status: lookup.status });
    }

    const body = await request.json().catch(() => ({}));
    const patch = {};

    if (Object.prototype.hasOwnProperty.call(body, 'role')) {
      const nextRole = normalizeRole(body.role);
      if (!nextRole) {
        return NextResponse.json({ ok: false, error: 'Cargo inválido.' }, { status: 400 });
      }

      if (nextRole === 'owner' && auth.role !== 'owner') {
        return NextResponse.json({ ok: false, error: 'Apenas owners podem promover outro usuário a owner.' }, { status: 403 });
      }

      patch.role = nextRole;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      const nextStatus = normalizeStatus(body.status);
      if (!nextStatus) {
        return NextResponse.json({ ok: false, error: 'Status inválido.' }, { status: 400 });
      }
      patch.status = nextStatus;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: 'Nenhuma alteração enviada.' }, { status: 400 });
    }

    const removeLastOwner = await wouldRemoveLastOwner({
      supabaseAdmin,
      workspaceId: auth.workspaceId,
      targetMember: lookup.member,
      nextRole: patch.role || null,
      nextStatus: patch.status || null,
    });

    if (removeLastOwner) {
      return NextResponse.json(
        { ok: false, error: 'Não é possível remover ou rebaixar o último owner ativo do workspace.' },
        { status: 409 }
      );
    }

    if (lookup.member.user_id === auth.userId && patch.status && patch.status !== 'active') {
      return NextResponse.json(
        { ok: false, error: 'Você não pode desativar o seu próprio acesso.' },
        { status: 409 }
      );
    }

    const { data: updated, error } = await supabaseAdmin
      .from('workspace_members')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', lookup.member.id)
      .eq('workspace_id', auth.workspaceId)
      .select('id, workspace_id, user_id, role, status, created_at, updated_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, member: updated });
  } catch (error) {
    console.error('[PATCH /api/workspace/team/[memberId]] Erro:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno ao atualizar membro.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  const supabaseAdmin = getSupabaseAdmin();
  const auth = await requireWorkspaceAdmin({
    supabase: supabaseAdmin,
    request,
    logPrefix: '[WORKSPACE_TEAM_MEMBER][DELETE]',
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const memberId = String(context?.params?.memberId || '').trim();
    if (!memberId) {
      return NextResponse.json({ ok: false, error: 'memberId obrigatório.' }, { status: 400 });
    }

    const lookup = await getMemberOrError({ supabaseAdmin, workspaceId: auth.workspaceId, memberId });
    if (!lookup.ok) {
      return NextResponse.json({ ok: false, error: lookup.error }, { status: lookup.status });
    }

    if (lookup.member.user_id === auth.userId) {
      return NextResponse.json(
        { ok: false, error: 'Você não pode remover seu próprio usuário da equipe.' },
        { status: 409 }
      );
    }

    const removeLastOwner = await wouldRemoveLastOwner({
      supabaseAdmin,
      workspaceId: auth.workspaceId,
      targetMember: lookup.member,
      nextStatus: 'inactive',
    });

    if (removeLastOwner) {
      return NextResponse.json(
        { ok: false, error: 'Não é possível remover o último owner ativo do workspace.' },
        { status: 409 }
      );
    }

    const { data: updated, error } = await supabaseAdmin
      .from('workspace_members')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', lookup.member.id)
      .eq('workspace_id', auth.workspaceId)
      .select('id, workspace_id, user_id, role, status, created_at, updated_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, member: updated });
  } catch (error) {
    console.error('[DELETE /api/workspace/team/[memberId]] Erro:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno ao remover membro.' },
      { status: 500 }
    );
  }
}
