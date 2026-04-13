import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function normalizeText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function normalizeYoutubeId(value) {
  const input = String(value || '').trim();
  if (!input) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }

  try {
    const url = new URL(input);

    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.replace('/', '').trim();
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (url.hostname.includes('youtube.com')) {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

      const parts = url.pathname.split('/').filter(Boolean);
      const maybeId = parts[parts.length - 1];
      return /^[a-zA-Z0-9_-]{11}$/.test(maybeId) ? maybeId : null;
    }
  } catch {
    return null;
  }

  return null;
}

function buildThumbnailUrl(youtubeId, fallback = null) {
  if (!youtubeId) return fallback || null;
  return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
}

async function findExistingCatalogSong(supabase, { title, artist, youtubeId }) {
  if (youtubeId) {
    const { data, error } = await supabase
      .from('suggestion_songs')
      .select('id, title, artist, youtube_id, source_type')
      .eq('youtube_id', youtubeId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return data;
  }

  const { data, error } = await supabase
    .from('suggestion_songs')
    .select('id, title, artist, youtube_id, source_type')
    .eq('normalized_title', String(title || '').toLowerCase())
    .eq('normalized_artist', String(artist || '').toLowerCase())
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function POST(request) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const title = normalizeText(body?.title);
    const artist = normalizeText(body?.artist) || '';
    const youtubeUrl = normalizeText(body?.youtube_url);
    const youtubeId = normalizeYoutubeId(body?.youtube_id || body?.youtube_url);
    const thumbnailUrl = normalizeText(body?.thumbnail_url) || buildThumbnailUrl(youtubeId, null);

    if (!title) {
      return NextResponse.json({ ok: false, error: 'Título da música é obrigatório.' }, { status: 400 });
    }

    const existing = await findExistingCatalogSong(supabase, { title, artist, youtubeId });
    if (existing?.id) {
      return NextResponse.json({
        ok: true,
        alreadyExists: true,
        message: 'Esta música já está no catálogo',
        song: existing,
      });
    }

    const payload = {
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

    const hasYoutubeId = Boolean(youtubeId);
    const onConflict = hasYoutubeId ? 'youtube_id' : 'normalized_title,normalized_artist';

    const { data: inserted, error: insertError } = await supabase
      .from('suggestion_songs')
      .upsert(payload, {
        onConflict,
        ignoreDuplicates: false,
      })
      .select('id, title, artist, youtube_id, source_type')
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      ok: true,
      alreadyExists: false,
      message: 'Música importada para o catálogo editorial com sucesso.',
      song: inserted,
    });
  } catch (error) {
    console.error('[admin/suggestions/repertoire-songs/import] error', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Falha ao importar música para o catálogo.' },
      { status: 500 }
    );
  }
}
