import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { sendWhatsAppMessage } from '../../../../lib/whatsapp/send-whatsapp-message';
import { buildInviteMessage } from '../../../../lib/whatsapp/build-invite-message';

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

export async function POST(request) {
  const supabaseAdmin = getSupabaseAdmin();
  try {
    const body = await request.json();
    const inviteId = body?.inviteId;

    if (!inviteId) {
      return NextResponse.json(
        { error: 'inviteId é obrigatório' },
        { status: 400 }
      );
    }

    const { data: invite, error } = await supabaseAdmin
      .from('invites')
      .select(`
        id,
        event_id,
        contact_id,
        suggested_role_name,
        status,
        invite_token,
        whatsapp_sent_at,
        whatsapp_send_count,
        contact:contacts(id, name, phone, email),
        event:events(id, client_name, event_date, event_time, location_name)
      `)
      .eq('id', inviteId)
      .single();

    if (error || !invite) {
      return NextResponse.json(
        { error: 'Invite não encontrado' },
        { status: 404 }
      );
    }

    if (String(invite.status || '').toLowerCase() === 'removed') {
      return NextResponse.json(
        { error: 'Invite removido, envio cancelado' },
        { status: 400 }
      );
    }

    const phone = cleanPhone(invite.contact?.phone);
    if (!phone) {
      return NextResponse.json(
        { error: 'Contato sem telefone' },
        { status: 400 }
      );
    }

    let inviteToken = invite.invite_token;
    if (!inviteToken) {
      inviteToken = crypto.randomUUID();

      const { error: tokenError } = await supabaseAdmin
        .from('invites')
        .update({ invite_token: inviteToken })
        .eq('id', invite.id);

      if (tokenError) {
        throw tokenError;
      }
    }

    const baseUrl = process.env.APP_BASE_URL;
    if (!baseUrl) {
      throw new Error('APP_BASE_URL não configurada');
    }

    const inviteLink = `${baseUrl}/membro/${inviteToken}`;

    const message = buildInviteMessage({
      contactName: invite.contact?.name,
      event: invite.event,
      inviteLink,
      role: invite.suggested_role_name,
    });

    await sendWhatsAppMessage({
      to: phone,
      message,
    });

    const { error: updateError } = await supabaseAdmin
      .from('invites')
      .update({
        whatsapp_sent_at: new Date().toISOString(),
        whatsapp_send_count: Number(invite.whatsapp_send_count || 0) + 1,
        whatsapp_last_error: null,
      })
      .eq('id', invite.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      ok: true,
      inviteId: invite.id,
      phone,
    });
  } catch (error) {
    console.error('Erro ao enviar convite via WhatsApp:', error);

    return NextResponse.json(
      { error: error?.message || 'Erro interno ao enviar convite' },
      { status: 500 }
    );
  }
}
