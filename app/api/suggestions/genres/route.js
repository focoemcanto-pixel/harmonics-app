import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import { isMissingWorkspaceColumnError, logSuggestionScope, migrationRequiredPayload } from '@/lib/sugestoes/workspace-scope';


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

async function fetchGenres(supabase, workspaceId) {
  const { data, error } = await supabase
    .from('suggestion_genres')
    .select('id, workspace_id, name, slug, is_active, sort_order, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function GET(request) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = await requireWorkspaceAccess({ supabase, request, moduleKey: 'sugestoes', actionKey: 'read', logPrefix: '[SUGGESTIONS_GENRES_API]' });

    if (!auth.ok) {
      return NextResponse.json({ ok: false, genres: [], error: auth.error || 'Acesso não autorizado.' }, { status: auth.status || 401 });
    }

    const genres = await fetchGenres(supabase, auth.workspaceId);
    logSuggestionScope('[sugestoes] data loaded genres', { count: genres.length, workspaceId: auth.workspaceId });

    return NextResponse.json({ ok: true, genres, workspaceId: auth.workspaceId });
  } catch (error) {
    if (isMissingWorkspaceColumnError(error)) {
      return NextResponse.json(migrationRequiredPayload('genres'));
    }
    console.error('[sugestoes] error genres', error);
    return NextResponse.json({ error: error?.message || 'Gêneros não encontrados na tabela suggestion_genres' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = await requireWorkspaceAccess({ supabase, request, moduleKey: 'sugestoes', actionKey: 'write', logPrefix: '[SUGGESTIONS_GENRES_POST_API]' });

    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error || 'Acesso não autorizado.' }, { status: auth.status || 401 });
    }

    const body = await request.json();
    const name = String(body?.name || '').trim();
    const baseSlug = String(body?.slug || '').trim() || slugify(name);
    const slug = scopedSlug(baseSlug, auth.workspaceId);
    const is_active = typeof body?.is_active === 'boolean' ? body.is_active : true;
    const sort_order = Number.isFinite(Number(body?.sort_order)) ? Number(body.sort_order) : 0;

    if (!name) {
      return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('suggestion_genres')
      .insert({ workspace_id: auth.workspaceId, name, slug, is_active, sort_order })
      .select('*')
      .single();

    if (error) throw error;

    logSuggestionScope('[sugestoes] created genre', { id: data?.id, workspaceId: auth.workspaceId });
    return NextResponse.json({ ok: true, genre: data, workspaceId: auth.workspaceId });
  } catch (error) {
    console.error('Erro ao criar suggestion_genre:', error);
    return NextResponse.json({ error: error?.message || 'Erro ao criar gênero' }, { status: error?.status || 500 });
  }
}
