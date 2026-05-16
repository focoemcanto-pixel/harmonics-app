import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';


function scopedSlug(baseSlug, workspaceId) {
  const suffix = `-${String(workspaceId).slice(0, 8)}`;
  return String(baseSlug || '').endsWith(suffix) ? String(baseSlug || '') : `${baseSlug}${suffix}`;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function PATCH(request, context) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = await requireWorkspaceAccess({ supabase, request, moduleKey: 'sugestoes', actionKey: 'write', logPrefix: '[SUGGESTIONS_GENRES_PATCH_API]' });
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error || 'Acesso não autorizado.' }, { status: auth.status || 401 });

    const routeParams = await context?.params;
    const id = String(routeParams?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });

    const body = await request.json();
    const name = String(body?.name || '').trim();
    const baseSlug = String(body?.slug || '').trim() || slugify(name);
    const slug = scopedSlug(baseSlug, auth.workspaceId);
    const is_active = typeof body?.is_active === 'boolean' ? body.is_active : true;
    const sort_order = Number.isFinite(Number(body?.sort_order)) ? Number(body.sort_order) : 0;

    if (!name) return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });

    const { data, error } = await supabase
      .from('suggestion_genres')
      .update({ name, slug, is_active, sort_order, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', auth.workspaceId)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!data?.id) return NextResponse.json({ ok: false, error: 'Gênero não encontrado neste workspace.' }, { status: 404 });

    return NextResponse.json({ ok: true, genre: data, workspaceId: auth.workspaceId });
  } catch (error) {
    console.error('Erro ao atualizar suggestion_genre:', error);
    return NextResponse.json({ error: error?.message || 'Erro ao atualizar gênero' }, { status: error?.status || 500 });
  }
}

export async function DELETE(request, context) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = await requireWorkspaceAccess({ supabase, request, moduleKey: 'sugestoes', actionKey: 'write', logPrefix: '[SUGGESTIONS_GENRES_DELETE_API]' });
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error || 'Acesso não autorizado.' }, { status: auth.status || 401 });

    const routeParams = await context?.params;
    const id = String(routeParams?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });

    const { error } = await supabase.from('suggestion_genres').delete().eq('id', id).eq('workspace_id', auth.workspaceId);
    if (error) throw error;

    return NextResponse.json({ ok: true, deletedId: id, workspaceId: auth.workspaceId });
  } catch (error) {
    console.error('Erro ao excluir suggestion_genre:', error);
    return NextResponse.json({ error: error?.message || 'Erro ao excluir gênero' }, { status: error?.status || 500 });
  }
}
