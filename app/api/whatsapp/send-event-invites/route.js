import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { sendInviteService } from '../../../../lib/whatsapp/send-invite-service';

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

    const results = [];
    for (const invite of pendentes) {
      console.info('[batch_send_invites] invite_started', {
        eventId,
        inviteId: invite.id,
      });

      const inviteResult = await sendInviteService({
        inviteId: invite.id,
        supabaseAdmin,
      });

      const resultItem = {
        inviteId: invite.id,
        ok: inviteResult.ok,
        status: inviteResult.status,
      };

      if (inviteResult.ok) {
        resultItem.data = inviteResult.data || {};
        console.info('[batch_send_invites] invite_finished', {
          eventId,
          inviteId: invite.id,
          status: inviteResult.status,
        });
      } else {
        resultItem.error = inviteResult.error || inviteResult.data?.error || 'Falha ao enviar convite';
        resultItem.data = inviteResult.data || {};
        console.error('[batch_send_invites] invite_failed', {
          eventId,
          inviteId: invite.id,
          status: inviteResult.status,
          error: resultItem.error,
        });
      }

      results.push(resultItem);
    }

    const successCount = results.filter((result) => result.ok === true).length;
    const failedCount = results.length - successCount;
    const hasFailures = failedCount > 0;
    const firstFailed = results.find((result) => result.ok !== true);
    const firstError =
      firstFailed?.error ||
      firstFailed?.data?.firstError ||
      firstFailed?.data?.error ||
      firstFailed?.data?.cause ||
      firstFailed?.data?.details ||
      (firstFailed ? `Falha no invite ${firstFailed.inviteId} (status ${firstFailed.status})` : null);
    const status = hasFailures ? (successCount > 0 ? 207 : 500) : 200;

    return NextResponse.json(
      {
        ok: failedCount === 0,
        total: pendentes.length,
        successCount,
        failedCount,
        results,
        firstError,
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
