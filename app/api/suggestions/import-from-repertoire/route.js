import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const DEFAULT_ARTIST = 'Não informado';
const CATALOG_SOURCE_TYPES = ['admin', 'imported'];

function normalizeText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function extractYoutubeIdFromUrl(url) {
  const value = String(url || '').trim();
  if (!value) return null;

  const watchRegex = /(?:[?&]v=)([A-Za-z0-9_-]{11})/;
  const shortRegex = /youtu\.be\/([A-Za-z0-9_-]{11})/;

  const fromWatch = value.match(watchRegex)?.[1];
  if (fromWatch) return fromWatch;

  const fromShort = value.match(shortRegex)?.[1];
  if (fromShort) return fromShort;

  return null;
}

function normalizeTitle(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function findDuplicateSong(supabase, { youtubeId, normalizedTitle, artist }) {
  if (youtubeId) {
    const { data, error } = await supabase
      .from('suggestion_songs')
      .select('id')
      .eq('youtube_id', youtubeId)
      .in('source_type', CATALOG_SOURCE_TYPES)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return data;
  }

  const { data, error } = await supabase
    .from('suggestion_songs')
    .select('id')
    .eq('normalized_title', normalizedTitle)
    .eq('normalized_artist', String(artist || '').toLowerCase())
    .in('source_type', CATALOG_SOURCE_TYPES)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const repertoireItemId = normalizeText(body?.repertoire_item_id);

    if (!repertoireItemId) {
      return NextResponse.json({ ok: false, error: 'repertoire_item_id é obrigatório.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: repertoireItem, error: repertoireError } = await supabase
      .from('repertoire_items')
      .select('id, song_name, artists, reference_video_id, reference_link, reference_thumbnail, notes')
      .eq('id', repertoireItemId)
      .limit(1)
      .maybeSingle();

    if (repertoireError) throw repertoireError;

    if (!repertoireItem?.id) {
      return NextResponse.json({ ok: false, error: 'Item de repertório não encontrado.' }, { status: 404 });
    }

    const songName = normalizeText(repertoireItem.song_name);
    if (!songName) {
      return NextResponse.json({ ok: false, error: 'Item de repertório sem song_name válido.' }, { status: 400 });
    }

    const youtubeId =
      normalizeText(repertoireItem.reference_video_id) || extractYoutubeIdFromUrl(repertoireItem.reference_link);
    const youtubeUrl =
      normalizeText(repertoireItem.reference_link) || (youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : null);
    const thumbnailUrl =
      normalizeText(repertoireItem.reference_thumbnail) ||
      (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null);
    const artist = normalizeText(repertoireItem.artists) || DEFAULT_ARTIST;
    const normalizedTitle = normalizeTitle(songName);

    const duplicate = await findDuplicateSong(supabase, {
      youtubeId,
      normalizedTitle,
      artist,
    });

    if (duplicate?.id) {
      return NextResponse.json({ ok: true, alreadyExists: true });
    }

    const now = new Date().toISOString();
    const payload = {
      title: songName,
      artist,
      youtube_id: youtubeId,
      youtube_url: youtubeUrl,
      thumbnail_url: thumbnailUrl,
      description: normalizeText(repertoireItem.notes),
      source_type: 'imported',
      is_active: true,
      is_featured: false,
      created_at: now,
      updated_at: now,
    };

    const { error: insertError } = await supabase.from('suggestion_songs').insert(payload);
    if (insertError) throw insertError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[suggestions/import-from-repertoire] error', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Falha ao importar item de repertório para o catálogo.' },
      { status: 500 }
    );
  }
}
