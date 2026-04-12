import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const eventId = String(body?.eventId || '').trim();

    if (!eventId) {
      return NextResponse.json(
        { ok: false, error: 'eventId é obrigatório.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: updatedConfig, error } = await supabase
      .from('repertoire_config')
      .update({
        status: 'EM_EDICAO',
        is_locked: false,
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', eventId)
      .select('id, event_id, status, is_locked, updated_at')
      .maybeSingle();

    if (error) throw error;

    if (!updatedConfig) {
      return NextResponse.json(
        { ok: false, error: 'Configuração de repertório não encontrada.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      eventId: updatedConfig.event_id,
      status: updatedConfig.status,
      locked: updatedConfig.is_locked,
      updatedAt: updatedConfig.updated_at,
    });
  } catch (error) {
    console.error('[API ADMIN] Erro ao liberar revisão de repertório:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Não foi possível liberar a revisão.',
      },
      { status: 500 }
    );
  }
}
