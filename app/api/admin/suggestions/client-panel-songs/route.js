import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { loadClientPanelSuggestions } from '@/lib/sugestoes/client-panel-suggestions-source';

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

    const [clientSuggestions, { data: catalogRows, error: catalogError }] = await Promise.all([
      loadClientPanelSuggestions(),
      supabase
        .from('suggestion_songs')
        .select('id, title, artist, youtube_id, source_type')
        .or('source_type.eq.admin,source_type.is.null'),
    ]);

    if (catalogError) throw catalogError;

    const catalogByKey = new Map();
    for (const song of catalogRows || []) {
      const key = buildSongKey({
        title: song?.title,
        artist: song?.artist,
        youtubeId: song?.youtube_id,
      });
      if (!catalogByKey.has(key)) catalogByKey.set(key, song);
    }

    const songs = clientSuggestions.map((song, index) => {
      const key = buildSongKey({
        title: song?.title,
        artist: song?.artist,
        youtubeId: song?.youtube_id,
      });
      const existing = catalogByKey.get(key);

      return {
        key: song?.id ? `client:${song.id}` : `client-index:${index}`,
        source_key: key,
        title: normalizeText(song?.title),
        artist: normalizeText(song?.artist),
        genre: normalizeText(song?.genre) || null,
        moment: normalizeText(song?.moment) || null,
        youtube_id: normalizeText(song?.youtube_id) || null,
        youtube_url: normalizeText(song?.youtube_url) || null,
        thumbnail_url: normalizeText(song?.thumbnail_url) || null,
        already_in_catalog: Boolean(existing?.id),
        catalog_song_id: existing?.id || null,
        catalog_source_type: existing?.source_type || null,
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
