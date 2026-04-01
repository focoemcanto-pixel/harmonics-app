import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const token = String(body?.token || '').trim();
    const rating = Number(body?.rating || 0);
    const testimonial = String(body?.testimonial || '').trim();
    const would_recommend =
      typeof body?.would_recommend === 'boolean'
        ? body.would_recommend
        : true;

    if (!token) {
      return NextResponse.json(
        { error: 'token é obrigatório' },
        { status: 400 }
      );
    }

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'rating deve estar entre 1 e 5' },
        { status: 400 }
      );
    }

    const { data: precontract, error: precontractError } = await supabase
      .from('precontracts')
      .select('id, public_token, event_id')
      .eq('public_token', token)
      .maybeSingle();

    if (precontractError) throw precontractError;
    if (!precontract?.event_id) {
      return NextResponse.json(
        { error: 'Token inválido para avaliação' },
        { status: 404 }
      );
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, client_name, event_date')
      .eq('id', precontract.event_id)
      .maybeSingle();

    if (eventError) throw eventError;
    if (!event) {
      return NextResponse.json(
        { error: 'Evento não encontrado' },
        { status: 404 }
      );
    }

    const eventTitle = event.client_name
      ? `Evento • ${event.client_name}`
      : 'Evento';

    const payload = {
      event_id: event.id,
      precontract_id: precontract.id,
      token,
      client_name: event.client_name || null,
      event_title: eventTitle,
      rating,
      testimonial: testimonial || null,
      would_recommend,
      status: 'published',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error: saveError } = await supabase
      .from('client_reviews')
      .upsert(payload, { onConflict: 'event_id' })
      .select('*')
      .single();

    if (saveError) throw saveError;

    return NextResponse.json({
      ok: true,
      review: saved,
    });
  } catch (error) {
    console.error('Erro ao salvar client_review:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro ao salvar avaliação' },
      { status: 500 }
    );
  }
}
