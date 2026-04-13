import { getSupabaseAdmin } from '../supabase-admin';
import { executeAutomationEvent } from '../automation/execute-automation-event';
import { safeLogDispatch } from '../automation/log-dispatch';
import { getDefaultWorkspaceSettings } from '../automation/get-workspace';

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

async function logInviteFailure({ inviteId, stage, message }) {
  const workspace = await getDefaultWorkspaceSettings();
  await safeLogDispatch({
    workspaceId: workspace.id,
    ruleId: null,
    templateId: null,
    channelId: null,
    entityId: inviteId || null,
    entityType: 'invite',
    recipientType: 'member',
    recipient: null,
    renderedMessage: null,
    metadata: { eventType: 'invite_member', stage },
    providerResponse: null,
    status: 'failed',
    errorMessage: message,
    source: 'automation_center',
  });
}

export async function sendInviteService({ inviteId, supabaseAdmin = getSupabaseAdmin() }) {
  try {
    if (!inviteId) {
      return {
        ok: false,
        status: 400,
        error: 'inviteId é obrigatório',
      };
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
      return {
        ok: false,
        status: 404,
        error: 'Invite não encontrado',
      };
    }

    if (String(invite.status || '').toLowerCase() === 'removed') {
      const removedMessage = 'Invite removido, envio cancelado';
      await logInviteFailure({
        inviteId: invite.id,
        stage: 'invite_validation',
        message: removedMessage,
      });
      return {
        ok: false,
        status: 400,
        error: removedMessage,
      };
    }

    const phone = cleanPhone(invite.contact?.phone);
    if (!phone) {
      const phoneMessage = 'Contato sem telefone';
      await logInviteFailure({
        inviteId: invite.id,
        stage: 'recipient_resolution',
        message: phoneMessage,
      });
      return {
        ok: false,
        status: 400,
        error: phoneMessage,
      };
    }

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

    const result = await executeAutomationEvent({
      eventType: 'invite_member',
      entityId: invite.id,
    });

    if (result.sent === 0 && result.skipped === 0 && result.failed === 0) {
      return {
        ok: true,
        status: 200,
        data: {
          ok: true,
          inviteId: invite.id,
          phone,
          warning: result.message || 'Nenhuma regra ativa encontrada para invite_member',
        },
      };
    }

    if (result.failed > 0 && result.sent === 0) {
      const firstFailedExecution = result.executions.find((execution) => execution.status === 'failed');
      const firstError = firstFailedExecution?.error;
      const providerError = firstFailedExecution?.providerError || null;
      const errorMessage = firstError || result.message || 'Erro ao enviar convite pelo motor de automação';

      await supabaseAdmin
        .from('invites')
        .update({ whatsapp_last_error: errorMessage })
        .eq('id', invite.id);

      return {
        ok: false,
        status: 500,
        error: errorMessage,
        data: {
          error: errorMessage,
          cause: errorMessage,
          providerError,
          sent: result.sent,
          failed: result.failed,
          skipped: result.skipped,
          executions: result.executions,
        },
      };
    }

    const { error: updateError } = await supabaseAdmin
      .from('invites')
      .update({
        whatsapp_sent_at: new Date().toISOString(),
        whatsapp_send_count: Number(invite.whatsapp_send_count || 0) + 1,
        whatsapp_last_error: null,
      })
      .eq('id', invite.id);

    if (updateError) {
      console.error('[send-invite-service] Erro ao atualizar campos de rastreamento:', updateError);
    }

    return {
      ok: true,
      status: 200,
      data: {
        ok: true,
        inviteId: invite.id,
        phone,
        executions: result.executions,
        sent: result.sent,
        skipped: result.skipped,
      },
    };
  } catch (error) {
    const rootCause =
      error?.message ||
      error?.cause?.message ||
      error?.details ||
      error?.hint ||
      'Erro interno ao enviar convite';

    try {
      await logInviteFailure({
        inviteId,
        stage: 'unexpected_catch',
        message: rootCause,
      });
    } catch (logError) {
      console.error('[send-invite-service] Erro ao salvar falha em automation_logs:', logError);
    }

    if (inviteId) {
      await supabaseAdmin
        .from('invites')
        .update({ whatsapp_last_error: rootCause })
        .eq('id', inviteId);
    }

    return {
      ok: false,
      status: 500,
      error: rootCause,
      data: {
        error: rootCause,
        cause: rootCause,
      },
    };
  }
}
