import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';

function normalizeText(value) {
  const text = String(value || '').trim();
  return text || null;
}

async function findExistingCatalogSong(supabase, { title, artist, youtubeId, workspaceId }) {
  if (youtubeId) {
    const { data, error } = await supabase
      .from('suggestion_songs')
      .select('id, workspace_id, title, artist, youtube_id, source_type')
      .eq('workspace_id', workspaceId)
      .eq('youtube_id', youtubeId)
      .in('source_type', ['admin', 'imported'])
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return data;
  }

  const { data, error } = await supabase
    .from('suggestion_songs')
    .select('id, workspace_id, title, artist, youtube_id, source_type')
    .eq('workspace_id', workspaceId)
    .eq('normalized_title', String(title || '').toLowerCase())
    .eq('normalized_artist', String(artist || '').toLowerCase())
    .in('source_type', ['admin', 'imported'])
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function POST(request) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = await requireWorkspaceAdmin({ supabase, request, moduleKey: 'sugestoes', actionKey: 'write', logPrefix: '[ADMIN_SUGGESTIONS_IMPORT_API]' });
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error || 'Acesso não autorizado.' }, { status: auth.status || 401 });

    const workspaceId = auth.workspaceId;
    const body = await request.json();

    const title = normalizeText(body?.title);
    const artist = normalizeText(body?.artist) || '';
    const youtubeUrl = normalizeText(body?.youtube_url);
    const youtubeId = normalizeText(body?.youtube_id);
    const thumbnailUrl = normalizeText(body?.thumbnail_url);

    if (!title) {
      return NextResponse.json({ ok: false, error: 'Título da música é obrigatório.' }, { status: 400 });
    }

    const existing = await findExistingCatalogSong(supabase, { title, artist, youtubeId, workspaceId });
    if (existing?.id) {
      return NextResponse.json({
        ok: true,
        alreadyExists: true,
        message: 'Esta música já está no catálogo editorial.',
        song: existing,
      });
    }

    const payload = {
      workspace_id: workspaceId,
      title,
      artist: artist || null,
      youtube_url: youtubeUrl,
      youtube_id: youtubeId,
      thumbnail_url: thumbnailUrl,
      description: normalizeText(body?.description),
      is_active: true,
      is_featured: false,
      source_type: 'imported',
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertError } = await supabase
      .from('suggestion_songs')
      .insert(payload)
      .select('id, workspace_id, title, artist, youtube_id, source_type')
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      ok: true,
      alreadyExists: false,
      message: 'Sugestão do painel do cliente importada para o catálogo editorial.',
      song: inserted,
      workspaceId,
    });
  } catch (error) {
    console.error('[admin/suggestions/client-panel-songs/import] error', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Falha ao importar sugestão do cliente para o catálogo.' },
      { status: 500 }
    );
  }
}
