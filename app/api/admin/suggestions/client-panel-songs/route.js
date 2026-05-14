import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';

function normalizeText(value) {
  const text = String(value || '').trim();
  return text || '';
}

function buildSongKey({ title = '', artist = '', youtubeId = '' }) {
  const yt = normalizeText(youtubeId);
  if (yt) return `yt:${yt.toLowerCase()}`;

  const normalizedTitle = normalizeText(title).toLowerCase();
  const normalizedArtist = normalizeText(artist).toLowerCase();
  return `txt:${normalizedTitle}::${normalizedArtist}`;
}

function isMissingWorkspaceColumnError(error) {
  const message = String(error?.message || error?.details || '').toLowerCase();
  return message.includes('workspace_id') && (message.includes('does not exist') || message.includes('could not find'));
}

export async function GET(request) {
  const supabase = getSupabaseAdmin();
  const auth = await requireWorkspaceAccess({
    supabase,
    request,
    moduleKey: 'sugestoes',
    actionKey: 'read',
    logPrefix: '[ADMIN_SUGGESTIONS_CLIENT_PANEL_SONGS]',
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, songs: [], error: auth.error || 'Acesso não autorizado.' }, { status: auth.status || 401 });
  }

  try {
    const workspaceId = auth.workspaceId;

    const { data: catalogSongs, error } = await supabase
      .from('suggestion_songs')
      .select('id, workspace_id, title, artist, genre:suggestion_genres(name), moment:suggestion_moments(name), youtube_id, youtube_url, thumbnail_url, is_active, source_type, created_at')
      .eq('workspace_id', workspaceId)
      .eq('source_type', 'client')
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingWorkspaceColumnError(error)) {
        console.warn('[admin/suggestions/client-panel-songs] workspace_id missing; returning empty list to avoid cross-workspace leakage', {
          workspaceId,
          message: error?.message,
        });
        return NextResponse.json({ ok: true, songs: [], workspaceId, migrationRequired: true });
      }
      throw error;
    }

    const songs = (catalogSongs || [])
      .map((song, index) => {
        const key = buildSongKey({
          title: song?.title,
          artist: song?.artist,
          youtubeId: song?.youtube_id,
        });

        return {
          key: song?.id ? `client-panel:${song.id}` : `client-panel-index:${index}`,
          source_key: key,
          title: normalizeText(song?.title),
          artist: normalizeText(song?.artist),
          genre: normalizeText(song?.genre?.name) || null,
          moment: normalizeText(song?.moment?.name) || null,
          youtube_id: normalizeText(song?.youtube_id) || null,
          youtube_url: normalizeText(song?.youtube_url) || null,
          thumbnail_url: normalizeText(song?.thumbnail_url) || null,
          already_in_catalog: false,
          catalog_song_id: song?.id || null,
          catalog_source_type: song?.source_type || null,
          is_active: Boolean(song?.is_active),
        };
      })
      .filter((song) => song.title);

    return NextResponse.json({ ok: true, songs, workspaceId });
  } catch (error) {
    console.error('[admin/suggestions/client-panel-songs] error', error);
    return NextResponse.json(
      { ok: false, songs: [], error: error?.message || 'Falha ao carregar sugestões do painel do cliente.' },
      { status: 500 }
    );
  }
}
