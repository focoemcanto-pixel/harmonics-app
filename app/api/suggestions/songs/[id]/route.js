import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin';

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

function sanitizeSongPayload(body) {
  const youtubeId =
    normalizeYoutubeId(body?.youtube_id) ||
    normalizeYoutubeId(body?.youtube_url);

  return {
    title: String(body?.title || '').trim(),
    artist: String(body?.artist || '').trim() || null,
    genre_id: body?.genre_id || null,
    moment_id: body?.moment_id || null,
    youtube_url: String(body?.youtube_url || '').trim() || null,
    youtube_id: youtubeId,
    thumbnail_url:
      String(body?.thumbnail_url || '').trim() ||
      buildThumbnailUrl(youtubeId, null),
    description: String(body?.description || '').trim() || null,
    event_types: Array.isArray(body?.event_types) ? body.event_types : [],
    moments: Array.isArray(body?.moments) ? body.moments : [],
    styles: Array.isArray(body?.styles) ? body.styles : [],
    moods: Array.isArray(body?.moods) ? body.moods : [],
    priority_score: Number.isFinite(Number(body?.priority_score)) ? Number(body.priority_score) : 0,
    is_recommended: Boolean(body?.is_recommended),
    is_featured: Boolean(body?.is_featured),
    is_active:
      typeof body?.is_active === 'boolean' ? body.is_active : true,
    sort_order: Number.isFinite(Number(body?.sort_order))
      ? Number(body.sort_order)
      : 0,
    source_type: 'admin',
    updated_at: new Date().toISOString(),
  };
}

async function replaceSongTags(supabase, songId, tagIds = []) {
  const normalized = Array.from(
    new Set(
      (Array.isArray(tagIds) ? tagIds : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )
  );

  const { error: deleteError } = await supabase
    .from('suggestion_song_tags')
    .delete()
    .eq('song_id', songId);

  if (deleteError) throw deleteError;

  if (!normalized.length) return;

  const rows = normalized.map((tagId) => ({
    song_id: songId,
    tag_id: tagId,
  }));

  const { error: insertError } = await supabase
    .from('suggestion_song_tags')
    .insert(rows);

  if (insertError) throw insertError;
}

async function replaceSongCollections(supabase, songId, collectionIds = []) {
  const normalized = Array.from(
    new Set(
      (Array.isArray(collectionIds) ? collectionIds : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )
  );

  const { error: deleteError } = await supabase
    .from('suggestion_collection_songs')
    .delete()
    .eq('song_id', songId);

  if (deleteError) throw deleteError;

  if (!normalized.length) return;

  const rows = normalized.map((collectionId, index) => ({
    collection_id: collectionId,
    song_id: songId,
    sort_order: index,
  }));

  const { error: insertError } = await supabase
    .from('suggestion_collection_songs')
    .insert(rows);

  if (insertError) throw insertError;
}

async function fetchSongById(supabase, id) {
  const { data, error } = await supabase
    .from('suggestion_songs')
    .select(`
      id,
      title,
      artist,
      genre_id,
      moment_id,
      youtube_url,
      youtube_id,
      thumbnail_url,
      description,
      event_types,
      moments,
      styles,
      moods,
      priority_score,
      is_recommended,
      usage_count,
      is_featured,
      is_active,
      source_type,
      sort_order,
      created_at,
      updated_at,
      genre:suggestion_genres(id, name, slug, is_active, sort_order),
      moment:suggestion_moments(id, name, slug, is_active, sort_order),
      song_tags:suggestion_song_tags(
        id,
        tag:suggestion_tags(id, name, slug, is_active)
      ),
      collection_links:suggestion_collection_songs(
        id,
        sort_order,
        collection:suggestion_collections(id, name, slug, is_active, sort_order)
      )
    `)
    .eq('id', id)
    .eq('source_type', 'admin')
    .single();

  if (error) throw error;
  return data;
}

export async function PATCH(request, { params }) {
  try {
    const supabase = getSupabaseAdmin();
    const id = String(params?.id || '').trim();

    if (!id) {
      return NextResponse.json(
        { error: 'id é obrigatório' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const payload = sanitizeSongPayload(body);

    if (!payload.title) {
      return NextResponse.json(
        { error: 'title é obrigatório' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('suggestion_songs')
      .update(payload)
      .eq('id', id)
      .eq('source_type', 'admin');

    if (updateError) throw updateError;

    await replaceSongTags(supabase, id, body?.tag_ids || []);
    await replaceSongCollections(supabase, id, body?.collection_ids || []);

    const song = await fetchSongById(supabase, id);

    return NextResponse.json({
      ok: true,
      song,
    });
  } catch (error) {
    console.error('[sugestoes] error update song', error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          'Falha ao atualizar música na tabela suggestion_songs',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const supabase = getSupabaseAdmin();
    const id = String(params?.id || '').trim();

    if (!id) {
      return NextResponse.json(
        { error: 'id é obrigatório' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('suggestion_songs')
      .delete()
      .eq('id', id)
      .eq('source_type', 'admin');

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      deletedId: id,
    });
  } catch (error) {
    console.error('[sugestoes] error delete song', error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          'Falha ao excluir música da tabela suggestion_songs',
      },
      { status: 500 }
    );
  }
}
