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

function inferSuggestedSourceType(song) {
  if (!song) return 'admin';

  const links = Number(song.repertoire_links || 0);
  const hasEditorialUsage = Boolean(song.has_editorial_usage);
  const hasClientUsage = Boolean(song.has_client_usage);

  if (links === 0) return 'admin';
  if (hasClientUsage && !hasEditorialUsage) return 'client';
  if (hasEditorialUsage && !hasClientUsage) return 'imported';
  return 'imported';
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data: reviewRows, error } = await supabase.rpc('get_suggestion_songs_null_audit');

    if (error) throw error;

    const songs = (reviewRows || [])
      .map((song, index) => {
        const key = buildSongKey({
          title: song?.title,
          artist: song?.artist,
          youtubeId: song?.youtube_id,
        });

        const suggestedSourceType = inferSuggestedSourceType(song);
        const reviewClass = normalizeText(song?.suggested_classification) || 'needs_manual_review';

        return {
          key: song?.id ? `legacy-review:${song.id}` : `legacy-review-index:${index}`,
          source_key: key,
          title: normalizeText(song?.title),
          artist: normalizeText(song?.artist),
          genre: null,
          moment: null,
          youtube_id: normalizeText(song?.youtube_id) || null,
          youtube_url: normalizeText(song?.youtube_url) || null,
          thumbnail_url: normalizeText(song?.thumbnail_url) || null,
          usage_count: Number(song?.repertoire_links || 0),
          last_used_at: song?.created_at || null,
          last_event_client: reviewClass,
          already_in_catalog: true,
          catalog_song_id: song?.id || null,
          catalog_source_type: suggestedSourceType,
          is_active: Boolean(song?.is_active),
        };
      })
      .filter((song) => song.title);

    return NextResponse.json({ ok: true, songs });
  } catch (error) {
    console.error('[admin/suggestions/review-songs] error', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Falha ao carregar itens de revisão de source_type.' },
      { status: 500 }
    );
  }
}
