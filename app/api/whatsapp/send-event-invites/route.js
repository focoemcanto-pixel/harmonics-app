import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

export async function POST(request) {
  try {
    const body = await request.json();
    const eventId = body?.eventId;

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId é obrigatório' },
        { status: 400 }
      );
    }

    const { data: invites, error } = await supabaseAdmin
      .from('invites')
      .select('id, status, whatsapp_sent_at')
      .eq('event_id', eventId)
      .neq('status', 'removed');

    if (error) throw error;

    const pendentes = (invites || []).filter((invite) => !invite.whatsapp_sent_at);

    const results = [];
    for (const invite of pendentes) {
      const response = await fetch(`${process.env.APP_BASE_URL}/api/whatsapp/send-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId: invite.id }),
      });

      const data = await response.json().catch(() => ({}));

      results.push({
        inviteId: invite.id,
        ok: response.ok,
        data,
      });
    }

    return NextResponse.json({
      ok: true,
      total: pendentes.length,
      results,
    });
  } catch (error) {
    console.error('Erro ao enviar convites do evento:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
