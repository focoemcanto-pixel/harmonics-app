import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { fetchClientSuggestionsCatalog } from '@/lib/sugestoes/client-suggestions-catalog';

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
    const catalogSongs = await fetchClientSuggestionsCatalog(supabase);

    const songs = catalogSongs.map((song, index) => {
      const key = buildSongKey({
        title: song?.title,
        artist: song?.artist,
        youtubeId: song?.youtube_id,
      });

      return {
        key: song?.id ? `client:${song.id}` : `client-index:${index}`,
        source_key: key,
        title: normalizeText(song?.title),
        artist: normalizeText(song?.artist),
        genre: normalizeText(song?.genre?.name) || null,
        moment: normalizeText(song?.moment?.name) || null,
        youtube_id: normalizeText(song?.youtube_id) || null,
        youtube_url: normalizeText(song?.youtube_url) || null,
        thumbnail_url: normalizeText(song?.thumbnail_url) || null,
        already_in_catalog: Boolean(song?.id),
        catalog_song_id: song?.id || null,
        catalog_source_type: song?.source_type || null,
      };
    });

    return NextResponse.json({ ok: true, songs });
  } catch (error) {
    console.error('[admin/suggestions/client-panel-songs] error', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Falha ao carregar sugestões do painel do cliente.' },
      { status: 500 }
    );
  }
}
