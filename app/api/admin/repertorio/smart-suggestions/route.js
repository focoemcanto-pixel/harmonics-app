import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSmartSuggestionsForEvent } from '@/lib/sugestoes/smart-suggestions';

export async function POST(request) {
  try {
    const body = await request.json();
    const eventId = String(body?.eventId || '').trim();

    if (!eventId) {
      return NextResponse.json({ ok: false, error: 'eventId é obrigatório.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const [{ data: event, error: eventError }, { data: catalog, error: catalogError }] = await Promise.all([
      supabase.from('events').select('id, event_type').eq('id', eventId).single(),
      supabase
        .from('suggestion_songs')
        .select('id,title,artist,moments,styles,moods,event_types,priority_score,is_recommended,is_featured,usage_count,is_active,youtube_url,youtube_id,thumbnail_url')
        .eq('is_active', true)
        .eq('source_type', 'admin'),
    ]);

    if (eventError) throw eventError;
    if (catalogError) throw catalogError;

    const sections = ['entrada', 'cerimonia', 'receptivo', 'saida'];
    const suggestions = sections.reduce((acc, section) => {
      const ranked = getSmartSuggestionsForEvent(
        {
          event_type: event?.event_type || null,
          targetMoment: section,
          style: body?.style || null,
          mood: body?.mood || null,
        },
        catalog || []
      );

      acc[section] = ranked[section] || [];
      return acc;
    }, {});

    return NextResponse.json({
      ok: true,
      event,
      suggestions,
    });
  } catch (error) {
    console.error('[smart-suggestions] error', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao gerar sugestões inteligentes.' },
      { status: 500 }
    );
  }
}
