import { getSupabaseAdmin } from '../supabase-admin';
import { executeAutomationEvent } from '../automation/execute-automation-event';
import { safeLogDispatch } from '../automation/log-dispatch';
import {
  acquireInviteSendLock,
  clearStaleInviteSendLock,
  markInviteSentAndReleaseLock,
  releaseInviteSendLock,
} from './invite-send-lock';

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function maskPhone(value) {
  const digits = cleanPhone(value);
  if (!digits) return null;
  if (digits.length <= 4) return '****';
  return `${'*'.repeat(Math.max(digits.length - 4, 4))}${digits.slice(-4)}`;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function normalizeWorkspaceId(value) {
  const workspaceId = String(value || '').trim();
  return workspaceId || null;
}

async function logInviteFailure({ inviteId, stage, message, workspaceId = null }) {
  const resolvedWorkspaceId = normalizeWorkspaceId(workspaceId);

  if (!resolvedWorkspaceId) {
    console.error('[send-invite-service] Falha sem workspaceId — log de automação não será registrado para evitar vazamento cross-workspace.', {
      inviteId,
      stage,
      message,
    });
    return;
  }

  await safeLogDispatch({
    workspaceId: resolvedWorkspaceId,
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

export async function sendInviteService({ inviteId, supabaseAdmin = getSupabaseAdmin(), force = false }) {
  let workspaceId = null;
  let activeLock = null;
  let activeInvite = null;

  try {
    const safeInviteId = String(inviteId || '').trim();
    if (!isUuid(safeInviteId)) {
      return {
        ok: false,
        status: 400,
        error: 'inviteId inválido ou ausente',
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
        whatsapp_sent_at,
        whatsapp_send_count,
        contact:contacts(id, workspace_id, name, phone),
        event:events(id, workspace_id)
      `)
      .eq('id', safeInviteId)
      .single();

    if (error || !invite) {
      return {
        ok: false,
        status: 404,
        error: 'Invite não encontrado',
      };
    }

    activeInvite = invite;
    workspaceId = normalizeWorkspaceId(invite?.event?.workspace_id);

    if (!workspaceId) {
      return {
        ok: false,
        status: 422,
        error: 'Invite sem workspace associado ao evento.',
      };
    }

    const contactWorkspaceId = normalizeWorkspaceId(invite?.contact?.workspace_id);
    if (contactWorkspaceId && contactWorkspaceId !== workspaceId) {
      const mismatchMessage = 'Contato do convite pertence a outro workspace.';
      await logInviteFailure({
        inviteId: invite.id,
        stage: 'workspace_validation',
        message: mismatchMessage,
        workspaceId,
      });
      return {
        ok: false,
        status: 403,
        error: mismatchMessage,
      };
    }

    if (String(invite.status || '').toLowerCase() === 'removed') {
      const removedMessage = 'Invite removido, envio cancelado';
      await logInviteFailure({
        inviteId: invite.id,
        stage: 'invite_validation',
        message: removedMessage,
        workspaceId,
      });
      return {
        ok: false,
        status: 400,
        error: removedMessage,
      };
    }

    if (!force && invite.whatsapp_sent_at) {
      return {
        ok: true,
        status: 200,
        data: {
          ok: true,
          inviteId: invite.id,
          workspaceId,
          skipped: true,
          reason: 'Convite já enviado anteriormente.',
          whatsapp_sent_at: invite.whatsapp_sent_at,
        },
      };
    }

    const phone = cleanPhone(invite.contact?.phone);
    const phoneMasked = maskPhone(phone);
    if (!phone) {
      const phoneMessage = 'Contato sem telefone';
      await logInviteFailure({
        inviteId: invite.id,
        stage: 'recipient_resolution',
        message: phoneMessage,
        workspaceId,
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
        .eq('id', invite.id)
        .eq('event_id', invite.event_id);

      if (tokenError) {
        throw tokenError;
      }
    }

    const { data: freshInvite, error: freshInviteError } = await supabaseAdmin
      .from('invites')
      .select('id, whatsapp_sent_at, status')
      .eq('id', invite.id)
      .maybeSingle();

    if (freshInviteError) throw freshInviteError;

    if (!force && freshInvite?.whatsapp_sent_at) {
      return {
        ok: true,
        status: 200,
        data: {
          ok: true,
          inviteId: invite.id,
          workspaceId,
          phoneMasked,
          skipped: true,
          reason: 'Convite já enviado anteriormente.',
          whatsapp_sent_at: freshInvite.whatsapp_sent_at,
        },
      };
    }

    if (String(freshInvite?.status || invite.status || '').toLowerCase() === 'removed') {
      const removedMessage = 'Invite removido, envio cancelado';
      await logInviteFailure({
        inviteId: invite.id,
        stage: 'invite_validation_before_send',
        message: removedMessage,
        workspaceId,
      });
      return {
        ok: false,
        status: 409,
        error: removedMessage,
      };
    }

    await clearStaleInviteSendLock({
      supabaseAdmin,
      inviteId: invite.id,
      eventId: invite.event_id,
    });

    activeLock = await acquireInviteSendLock({
      supabaseAdmin,
      inviteId: invite.id,
      eventId: invite.event_id,
      force,
    });

    if (!activeLock?.acquired) {
      return {
        ok: true,
        status: 200,
        data: {
          ok: true,
          inviteId: invite.id,
          workspaceId,
          phoneMasked,
          skipped: true,
          reason: 'Convite já está em envio por outra execução ou já foi enviado.',
        },
      };
    }

    const result = await executeAutomationEvent({
      eventType: 'invite_member',
      entityId: invite.id,
      workspaceId,
    });

    if (result.sent === 0 && result.skipped === 0 && result.failed === 0) {
      await releaseInviteSendLock({
        supabaseAdmin,
        inviteId: invite.id,
        eventId: invite.event_id,
        token: activeLock.token,
      });
      activeLock = null;

      return {
        ok: true,
        status: 200,
        data: {
          ok: true,
          inviteId: invite.id,
          workspaceId,
          phoneMasked,
          warning: result.message || 'Nenhuma regra ativa encontrada para invite_member',
        },
      };
    }

    if (result.failed > 0 && result.sent === 0) {
      const firstFailedExecution = result.executions.find((execution) => execution.status === 'failed');
      const firstError = firstFailedExecution?.error;
      const providerError = firstFailedExecution?.providerError || null;
      const errorMessage = firstError || result.message || 'Erro ao enviar convite pelo motor de automação';

      await releaseInviteSendLock({
        supabaseAdmin,
        inviteId: invite.id,
        eventId: invite.event_id,
        token: activeLock.token,
        errorMessage,
      });
      activeLock = null;

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

    if (result.sent > 0) {
      try {
        await markInviteSentAndReleaseLock({ supabaseAdmin, invite, token: activeLock.token });
        activeLock = null;
      } catch (updateError) {
        console.error('[send-invite-service] Erro ao atualizar campos de rastreamento:', updateError);
      }
    }

    return {
      ok: true,
      status: 200,
      data: {
        ok: true,
        inviteId: invite.id,
        workspaceId,
        phoneMasked,
        executions: result.executions,
        sent: result.sent,
        skipped: result.skipped,
      },
    };
  } catch (error) {
    const rootCause =
      error?.message ||
      error?.cause?.message ||
      error?.cause ||
      error?.details ||
      error?.hint ||
      'Erro interno ao enviar convite';

    const providerStatus = error?.providerStatus ?? null;
    const providerEndpoint = error?.providerEndpoint || null;
    const providerResponse = error?.providerResponse || null;
    const providerResponseRaw = error?.providerResponseRaw || null;

    try {
      if (activeLock?.token && activeInvite?.id && activeInvite?.event_id) {
        await releaseInviteSendLock({
          supabaseAdmin,
          inviteId: activeInvite.id,
          eventId: activeInvite.event_id,
          token: activeLock.token,
          errorMessage: rootCause,
        });
        activeLock = null;
      }
    } catch (releaseError) {
      console.error('[send-invite-service] Erro ao liberar lock de envio:', releaseError);
    }

    try {
      await logInviteFailure({
        inviteId,
        stage: 'unexpected_catch',
        message: rootCause,
        workspaceId,
      });
    } catch (logError) {
      console.error('[send-invite-service] Erro ao salvar falha em automation_logs:', logError);
    }

    if (inviteId && !activeLock?.token) {
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
        providerStatus,
        providerEndpoint,
        providerResponse,
        providerResponseRaw,
      },
    };
  }
}
