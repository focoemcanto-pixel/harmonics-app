import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const SECTION_MAP = {
  entrada: 'cortejo',
  cerimonia: 'cerimonia',
  receptivo: 'receptivo',
  saida: 'saida',
};

export async function POST(request) {
  try {
    const body = await request.json();
    const eventId = String(body?.eventId || '').trim();
    const songId = String(body?.songId || '').trim();
    const sectionRaw = String(body?.section || '').trim().toLowerCase();
    const section = SECTION_MAP[sectionRaw] || 'cerimonia';

    if (!eventId || !songId) {
      return NextResponse.json(
        { ok: false, error: 'eventId e songId são obrigatórios.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: song, error: songError } = await supabase
      .from('suggestion_songs')
      .select('id,title,artist,youtube_url,youtube_id')
      .eq('id', songId)
      .single();

    if (songError) throw songError;

    const { data: existingItems, error: orderError } = await supabase
      .from('repertoire_items')
      .select('id, item_order')
      .eq('event_id', eventId)
      .eq('section', section)
      .order('item_order', { ascending: false })
      .limit(1);

    if (orderError) throw orderError;

    const nextOrder = Number(existingItems?.[0]?.item_order || -1) + 1;

    const { error: insertError } = await supabase.from('repertoire_items').insert({
      event_id: eventId,
      section,
      item_order: nextOrder,
      moment: sectionRaw,
      song_name: song?.title || 'Música sugerida',
      artists: song?.artist || null,
      reference_link: song?.youtube_url || null,
      reference_video_id: song?.youtube_id || null,
      type: 'smart_suggestion',
      notes: 'Adicionado pelo modo inteligente',
      suggestion_song_id: song.id,
    });

    if (insertError) throw insertError;

    const { error: usageError } = await supabase.rpc('increment_suggestion_song_usage', {
      p_song_id: song.id,
    });

    if (usageError) {
      console.warn('[smart-suggestions] usage update warning', usageError.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[use-suggestion] error', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao usar sugestão.' },
      { status: 500 }
    );
  }
}
