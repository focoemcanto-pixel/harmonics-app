import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function normalizeText(value) {
  const text = String(value || '').trim();
  return text || null;
}

async function findExistingCatalogSong(supabase, { title, artist, youtubeId }) {
  if (youtubeId) {
    const { data, error } = await supabase
      .from('suggestion_songs')
      .select('id, title, artist, youtube_id, source_type')
      .eq('youtube_id', youtubeId)
      .or('source_type.eq.admin,source_type.is.null')
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
    .or('source_type.eq.admin,source_type.is.null')
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
    const youtubeId = normalizeText(body?.youtube_id);
    const thumbnailUrl = normalizeText(body?.thumbnail_url);

    if (!title) {
      return NextResponse.json({ ok: false, error: 'Título da música é obrigatório.' }, { status: 400 });
    }

    const existing = await findExistingCatalogSong(supabase, { title, artist, youtubeId });
    if (existing?.id) {
      return NextResponse.json({
        ok: true,
        alreadyExists: true,
        message: 'Esta música já está no catálogo editorial.',
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
      source_type: 'admin',
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
      message: 'Sugestão do painel do cliente adicionada ao catálogo editorial.',
      song: inserted,
    });
  } catch (error) {
    console.error('[admin/suggestions/client-panel-songs/import] error', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Falha ao importar sugestão do cliente para o catálogo.' },
      { status: 500 }
    );
  }
}
