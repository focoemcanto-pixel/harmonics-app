import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

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

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data: catalogSongs, error } = await supabase
      .from('suggestion_songs')
      .select('id, title, artist, genre:suggestion_genres(name), moment:suggestion_moments(name), youtube_id, youtube_url, thumbnail_url, is_active, source_type, created_at')
      .or('source_type.eq.client,source_type.is.null')
      .order('created_at', { ascending: false });

    if (error) throw error;

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
          requires_legacy_review: song?.source_type == null,
        };
      })
      .filter((song) => song.title);

    return NextResponse.json({ ok: true, songs });
  } catch (error) {
    console.error('[admin/suggestions/client-panel-songs] error', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Falha ao carregar sugestões do painel do cliente.' },
      { status: 500 }
    );
  }
}
