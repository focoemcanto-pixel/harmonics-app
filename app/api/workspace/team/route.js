import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';

const ALLOWED_ROLES = new Set(['owner', 'admin', 'financeiro', 'operacional', 'editor', 'viewer']);

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeRole(value) {
  const role = String(value || 'viewer')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  return ALLOWED_ROLES.has(role) ? role : 'viewer';
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function mapMember(member) {
  const profile = member?.profile || null;
  return {
    id: member.id,
    workspace_id: member.workspace_id,
    user_id: member.user_id,
    role: member.role,
    status: member.status,
    created_at: member.created_at,
    updated_at: member.updated_at,
    profile: profile
      ? {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role,
        }
      : null,
  };
}

export async function GET(request) {
  const supabaseAdmin = getSupabaseAdmin();
  const auth = await requireWorkspaceAdmin({
    supabase: supabaseAdmin,
    request,
    logPrefix: '[WORKSPACE_TEAM][GET]',
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const [membersRes, invitesRes] = await Promise.all([
      supabaseAdmin
        .from('workspace_members')
        .select(
          `id, workspace_id, user_id, role, status, created_at, updated_at,
           profile:profiles(id, email, name, role)`
        )
        .eq('workspace_id', auth.workspaceId)
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('workspace_invites')
        .select('id, workspace_id, email, role, status, token, invited_by, accepted_by, accepted_at, expires_at, created_at, updated_at')
        .eq('workspace_id', auth.workspaceId)
        .order('created_at', { ascending: false }),
    ]);

    if (membersRes.error) throw membersRes.error;
    if (invitesRes.error) throw invitesRes.error;

    return NextResponse.json({
      ok: true,
      workspace: auth.workspace,
      current_member: auth.member,
      members: (membersRes.data || []).map(mapMember),
      invites: invitesRes.data || [],
    });
  } catch (error) {
    console.error('[GET /api/workspace/team] Erro:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno ao carregar equipe.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const supabaseAdmin = getSupabaseAdmin();
  const auth = await requireWorkspaceAdmin({
    supabase: supabaseAdmin,
    request,
    logPrefix: '[WORKSPACE_TEAM][POST]',
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    const role = normalizeRole(body?.role);

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: 'Informe um e-mail válido para convidar.' },
        { status: 400 }
      );
    }

    if (role === 'owner' && auth.role !== 'owner') {
      return NextResponse.json(
        { ok: false, error: 'Apenas owners podem convidar novos owners.' },
        { status: 403 }
      );
    }

    const { data: existingProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, name')
      .eq('email', email)
      .maybeSingle();

    if (profileError) throw profileError;

    if (existingProfile?.id) {
      const { data: existingMember, error: memberLookupError } = await supabaseAdmin
        .from('workspace_members')
        .select('id, role, status')
        .eq('workspace_id', auth.workspaceId)
        .eq('user_id', existingProfile.id)
        .maybeSingle();

      if (memberLookupError) throw memberLookupError;

      if (existingMember?.id) {
        if (existingMember.status === 'active') {
          return NextResponse.json(
            { ok: false, error: 'Este usuário já faz parte da equipe.' },
            { status: 409 }
          );
        }

        const { data: reactivated, error: reactivateError } = await supabaseAdmin
          .from('workspace_members')
          .update({ role, status: 'active', updated_at: new Date().toISOString() })
          .eq('id', existingMember.id)
          .select('id, workspace_id, user_id, role, status, created_at, updated_at')
          .single();

        if (reactivateError) throw reactivateError;

        return NextResponse.json({
          ok: true,
          mode: 'member_reactivated',
          member: reactivated,
        });
      }

      const { data: member, error: insertMemberError } = await supabaseAdmin
        .from('workspace_members')
        .insert({
          workspace_id: auth.workspaceId,
          user_id: existingProfile.id,
          role,
          status: 'active',
        })
        .select('id, workspace_id, user_id, role, status, created_at, updated_at')
        .single();

      if (insertMemberError) throw insertMemberError;

      return NextResponse.json({
        ok: true,
        mode: 'member_added_existing_profile',
        member,
      }, { status: 201 });
    }

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('workspace_invites')
      .upsert(
        {
          workspace_id: auth.workspaceId,
          email,
          role,
          status: 'pending',
          invited_by: auth.userId,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,email,status' }
      )
      .select('id, workspace_id, email, role, status, token, invited_by, accepted_by, accepted_at, expires_at, created_at, updated_at')
      .single();

    if (inviteError) throw inviteError;

    return NextResponse.json({
      ok: true,
      mode: 'invite_created',
      invite,
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/workspace/team] Erro:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno ao convidar membro.' },
      { status: 500 }
    );
  }
}
