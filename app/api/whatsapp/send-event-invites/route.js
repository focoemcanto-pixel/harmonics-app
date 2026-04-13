import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';

// LOGGING: Esta rota não registra logs individuais em automation_logs
// porque delega para /api/whatsapp/send-invite, que já registra cada envio.
// Ver: Fase 2 - Logging Unificado da Central de Automação

export async function POST(request) {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const body = await request.json();
    const eventId = body?.eventId;
    console.info('[automation][step] salvar_escala_trigger_received', { eventId });

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
    console.info('[automation][step] pending_invites_resolved', {
      eventId,
      totalInvites: (invites || []).length,
      pendingToSend: pendentes.length,
    });

    const internalEndpoint = new URL('/api/whatsapp/send-invite', request.url).toString();

    const results = [];
    for (const invite of pendentes) {
      console.info('[automation][step] send_invite_call_started', {
        eventId,
        inviteId: invite.id,
      });
      const response = await fetch(internalEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId: invite.id }),
      });

      const data = await response.json().catch(() => ({}));

      results.push({
        inviteId: invite.id,
        ok: response.ok,
        status: response.status,
        data,
      });
      console.info('[automation][step] send_invite_call_finished', {
        eventId,
        inviteId: invite.id,
        ok: response.ok,
        status: response.status,
      });
    }

    const successCount = results.filter((result) => result.ok === true).length;
    const failedCount = results.length - successCount;
    const hasFailures = failedCount > 0;
    const status = hasFailures ? (successCount > 0 ? 207 : 500) : 200;

    return NextResponse.json(
      {
        ok: failedCount === 0,
        total: pendentes.length,
        successCount,
        failedCount,
        results,
      },
      { status }
    );
  } catch (error) {
    console.error('Erro ao enviar convites do evento:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
