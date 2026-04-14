import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const DEFAULT_IMPORT_ARTIST = 'não informado';

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

function toTimestamp(value) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const [{ data: repertoireItems, error: repertoireError }, { data: catalogRows, error: catalogError }] =
      await Promise.all([
        supabase
          .from('repertoire_items')
          .select(`
            id,
            event_id,
            song_name,
            artists,
            reference_video_id,
            reference_link,
            reference_thumbnail,
            notes,
            created_at,
            events:event_id(id, client_name, event_date)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('suggestion_songs')
          .select('id, title, artist, youtube_id, source_type, is_active, created_at'),
      ]);

    if (repertoireError) throw repertoireError;
    if (catalogError) throw catalogError;

    const catalogByKey = new Map();
    for (const song of catalogRows || []) {
      const key = buildSongKey({
        title: song?.title,
        artist: song?.artist,
        youtubeId: song?.youtube_id,
      });
      if (!catalogByKey.has(key)) {
        catalogByKey.set(key, song);
      }
    }


    const catalogByTitleWithDefaultArtist = new Map();
    for (const song of catalogRows || []) {
      const titleKey = `txt:${normalizeText(song?.title).toLowerCase()}::${DEFAULT_IMPORT_ARTIST}`;
      if (!catalogByTitleWithDefaultArtist.has(titleKey)) {
        catalogByTitleWithDefaultArtist.set(titleKey, song);
      }
    }

    const aggregated = new Map();

    for (const item of repertoireItems || []) {
      const title = normalizeText(item?.song_name);
      if (!title) continue;

      const artist = normalizeText(item?.artists);
      const youtubeId = normalizeText(item?.reference_video_id);
      const key = buildSongKey({ title, artist, youtubeId });
      const eventRow = item?.events || null;
      const eventDate = eventRow?.event_date || null;
      const createdAt = item?.created_at || null;
      const currentTimestamp = Math.max(toTimestamp(eventDate), toTimestamp(createdAt));

      if (!aggregated.has(key)) {
        aggregated.set(key, {
          key,
          title,
          artist,
          youtube_id: youtubeId || null,
          youtube_url: normalizeText(item?.reference_link) || null,
          thumbnail_url: normalizeText(item?.reference_thumbnail) || null,
          usage_count: 0,
          last_used_at: null,
          last_event_date: null,
          last_event_client: null,
          already_in_catalog: false,
          catalog_song_id: null,
          catalog_source_type: null,
          repertoire_item_id: item?.id ? String(item.id) : null,
        });
      }

      const entry = aggregated.get(key);
      entry.usage_count += 1;

      const lastRecordedTs = toTimestamp(entry.last_used_at);
      if (currentTimestamp >= lastRecordedTs) {
        entry.last_used_at = eventDate || createdAt || entry.last_used_at;
        entry.last_event_date = eventDate || entry.last_event_date;
        entry.last_event_client = normalizeText(eventRow?.client_name) || entry.last_event_client;
        entry.repertoire_item_id = item?.id ? String(item.id) : entry.repertoire_item_id;
      }

      if (!entry.youtube_url && normalizeText(item?.reference_link)) {
        entry.youtube_url = normalizeText(item.reference_link);
      }
      if (!entry.thumbnail_url && normalizeText(item?.reference_thumbnail)) {
        entry.thumbnail_url = normalizeText(item.reference_thumbnail);
      }
    }

    const list = Array.from(aggregated.values()).map((entry) => {
      const fallbackKey = `txt:${normalizeText(entry?.title).toLowerCase()}::${DEFAULT_IMPORT_ARTIST}`;
      const existing = catalogByKey.get(entry.key) || catalogByTitleWithDefaultArtist.get(fallbackKey);
      return {
        ...entry,
        already_in_catalog: Boolean(existing?.id),
        catalog_song_id: existing?.id || null,
        catalog_source_type: existing?.source_type || null,
      };
    });

    list.sort((a, b) => {
      if (b.usage_count !== a.usage_count) return b.usage_count - a.usage_count;
      return toTimestamp(b.last_used_at) - toTimestamp(a.last_used_at);
    });

    return NextResponse.json({ ok: true, songs: list });
  } catch (error) {
    console.error('[admin/suggestions/repertoire-songs] error', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Falha ao carregar músicas de repertórios.' },
      { status: 500 }
    );
  }
}
