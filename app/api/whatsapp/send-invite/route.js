import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { executeAutomationEvent } from '../../../../lib/automation/execute-automation-event';
import { logAutomationDispatch } from '../../../../lib/automation/log-dispatch';
import { getDefaultWorkspaceSettings } from '../../../../lib/automation/get-workspace';

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

/**
 * Rota legada de envio de convite por WhatsApp.
 *
 * Migrada para usar o motor novo via executeAutomationEvent (Opção A — wrapper).
 * A única fonte real de envio e logging é o motor de automação.
 * Esta rota mantém suas responsabilidades únicas:
 *   - validação do invite (status, telefone)
 *   - geração do token de convite se ausente
 *   - atualização dos campos de rastreamento (whatsapp_sent_at, whatsapp_send_count)
 */
export async function POST(request) {
  const supabaseAdmin = getSupabaseAdmin();
  let inviteId;
  try {
    const body = await request.json();
    inviteId = body?.inviteId;
    console.info('[automation][send_invite] started', { inviteId });

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
        whatsapp_send_count,
        contact:contacts(id, name, phone)
      `)
      .eq('id', inviteId)
      .single();

    if (error || !invite) {
      return NextResponse.json(
        { error: 'Invite não encontrado' },
        { status: 404 }
      );
    }
    console.info('[automation][send_invite] invite_resolved', {
      inviteId: invite.id,
      eventId: invite.event_id,
      contactId: invite.contact_id,
      status: invite.status,
    });

    if (String(invite.status || '').toLowerCase() === 'removed') {
      const workspace = await getDefaultWorkspaceSettings();
      await logAutomationDispatch({
        workspaceId: workspace.id,
        ruleId: null,
        templateId: null,
        channelId: null,
        entityId: invite.id,
        entityType: 'invite',
        recipientType: 'member',
        recipient: null,
        renderedMessage: null,
        metadata: { eventType: 'invite_member', stage: 'invite_validation' },
        providerResponse: null,
        status: 'failed',
        errorMessage: 'Invite removido, envio cancelado',
        source: 'automation_center',
      });
      return NextResponse.json(
        { error: 'Invite removido, envio cancelado' },
        { status: 400 }
      );
    }

    const phone = cleanPhone(invite.contact?.phone);
    if (!phone) {
      const workspace = await getDefaultWorkspaceSettings();
      await logAutomationDispatch({
        workspaceId: workspace.id,
        ruleId: null,
        templateId: null,
        channelId: null,
        entityId: invite.id,
        entityType: 'invite',
        recipientType: 'member',
        recipient: null,
        renderedMessage: null,
        metadata: { eventType: 'invite_member', stage: 'recipient_resolution' },
        providerResponse: null,
        status: 'failed',
        errorMessage: 'Contato sem telefone',
        source: 'automation_center',
      });
      return NextResponse.json(
        { error: 'Contato sem telefone' },
        { status: 400 }
      );
    }
    console.info('[automation][send_invite] recipient_resolved', {
      inviteId: invite.id,
      recipient: phone,
    });

    // Garantir token de convite antes de chamar o motor (build-automation-context também faz isso,
    // mas fazemos aqui para garantir disponibilidade imediata no banco)
    if (!invite.invite_token) {
      const newToken = crypto.randomUUID();
      const { error: tokenError } = await supabaseAdmin
        .from('invites')
        .update({ invite_token: newToken })
        .eq('id', invite.id);

      if (tokenError) {
        throw tokenError;
      }
    }

    // Delegar envio ao motor novo — única fonte real de execução e logging
    const result = await executeAutomationEvent({
      eventType: 'invite_member',
      entityId: invite.id,
    });
    console.info('[automation][send_invite] automation_result', {
      inviteId: invite.id,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
    });

    // If the engine didn't find active rules, return a warning (sending was skipped — not an error)
    if (result.sent === 0 && result.skipped === 0 && result.failed === 0) {
      return NextResponse.json({
        ok: true,
        inviteId: invite.id,
        phone,
        warning: result.message || 'Nenhuma regra ativa encontrada para invite_member',
      });
    }

    // Se houve falhas, retornar erro
    if (result.failed > 0 && result.sent === 0) {
      const firstError = result.executions.find((e) => e.status === 'failed')?.error;
      return NextResponse.json(
        { error: firstError || 'Erro ao enviar convite pelo motor de automação' },
        { status: 500 }
      );
    }

    // Atualizar campos de rastreamento do invite
    const { error: updateError } = await supabaseAdmin
      .from('invites')
      .update({
        whatsapp_sent_at: new Date().toISOString(),
        whatsapp_send_count: Number(invite.whatsapp_send_count || 0) + 1,
        whatsapp_last_error: null,
      })
      .eq('id', invite.id);

    if (updateError) {
      console.error('[send-invite] Erro ao atualizar campos de rastreamento:', updateError);
    }

    return NextResponse.json({
      ok: true,
      inviteId: invite.id,
      phone,
      executions: result.executions,
      sent: result.sent,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error('[send-invite] Erro ao enviar convite via WhatsApp:', error);

    return NextResponse.json(
      { error: error?.message || 'Erro interno ao enviar convite' },
      { status: 500 }
    );
  }
}
