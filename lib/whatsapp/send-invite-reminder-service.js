import { getSupabaseAdmin } from '../supabase-admin';
import { executeAutomationEvent } from '../automation/execute-automation-event';
import {
  INVITE_REMINDER_EVENT_TYPE,
  MAX_INVITE_REMINDER_ATTEMPTS,
  evaluateInviteReminder,
  resolveReminderDays,
  todayInSaoPaulo,
} from '../automation/invite-dispatch';

const INVITE_REMINDER_SELECT = `
  id, event_id, status, sent_at, whatsapp_sent_at,
  reminder_5d_claimed_at, reminder_5d_sent_at, reminder_5d_attempts,
  event:events(id, workspace_id, event_date, status)
`;

function firstExecutionError(result) {
  const failed = (result?.executions || []).find((execution) => execution?.status !== 'sent' && execution?.error);
  return failed?.error || result?.message || null;
}

/**
 * Envia o lembrete de convite sem resposta (no máximo 1 por convite).
 *
 * Idempotência: a etapa é reivindicada por um UPDATE condicional
 * (reminder_5d_claimed_at IS NULL e reminder_5d_sent_at IS NULL), atômico no Postgres.
 * Cron concorrente, retry do curl, duas instâncias do Worker ou execução repetida:
 * só quem reivindicou envia. Depois que o provider aceita, o convite fica com
 * reminder_5d_sent_at; se a execução cair entre o aceite e a marcação, a reivindicação
 * permanece e o lembrete não é repetido (no máximo uma vez, nunca duas).
 * Erro explícito do provider libera a reivindicação para nova tentativa, até
 * MAX_INVITE_REMINDER_ATTEMPTS.
 */
export async function sendInviteReminderService({
  inviteId,
  workspaceId,
  rule = null,
  supabaseAdmin = getSupabaseAdmin(),
  execute = executeAutomationEvent,
  now = () => new Date(),
}) {
  const { data: invite, error: readError } = await supabaseAdmin
    .from('invites')
    .select(INVITE_REMINDER_SELECT)
    .eq('id', inviteId)
    .maybeSingle();
  if (readError) throw readError;

  const days = resolveReminderDays(rule);
  const evaluation = evaluateInviteReminder(invite, { days, workspaceId, now: now() });
  if (!evaluation.due) {
    return { status: 'skipped', reason: evaluation.reason, inviteId };
  }

  const previousAttempts = Number(invite.reminder_5d_attempts || 0);
  const attempt = previousAttempts + 1;
  const claimedAt = now().toISOString();

  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('invites')
    .update({
      reminder_5d_claimed_at: claimedAt,
      reminder_5d_attempts: attempt,
      reminder_5d_last_error: null,
    })
    .eq('id', invite.id)
    .eq('event_id', invite.event_id)
    .eq('status', 'pending')
    .eq('reminder_5d_attempts', previousAttempts)
    .is('reminder_5d_claimed_at', null)
    .is('reminder_5d_sent_at', null)
    .select('id')
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed?.id) {
    return { status: 'skipped', reason: 'claimed_by_another_execution', inviteId };
  }

  const releaseClaim = async (patch) => {
    const { error } = await supabaseAdmin
      .from('invites')
      .update(patch)
      .eq('id', invite.id)
      .eq('reminder_5d_claimed_at', claimedAt);
    if (error) {
      console.error('[invite-reminder] falha ao atualizar reivindicação', { inviteId: invite.id, error: error.message });
    }
  };

  let result;
  try {
    result = await execute({
      eventType: INVITE_REMINDER_EVENT_TYPE,
      entityId: invite.id,
      workspaceId,
      origin: 'cron',
      attempt,
    });
  } catch (error) {
    await releaseClaim({ reminder_5d_claimed_at: null, reminder_5d_last_error: error?.message || 'Erro desconhecido' });
    return { status: 'failed', reason: 'execution_error', error: error?.message || null, inviteId, attempt };
  }

  if (Number(result?.sent || 0) > 0) {
    await releaseClaim({ reminder_5d_sent_at: now().toISOString(), reminder_5d_last_error: null });
    return { status: 'sent', inviteId, attempt, executions: result.executions || [] };
  }

  if (Number(result?.failed || 0) > 0) {
    // Erro explícito do provider (não aceitou): libera para nova tentativa.
    await releaseClaim({ reminder_5d_claimed_at: null, reminder_5d_last_error: firstExecutionError(result) });
    return {
      status: 'failed',
      reason: attempt >= MAX_INVITE_REMINDER_ATTEMPTS ? 'provider_failed_attempts_exhausted' : 'provider_failed',
      error: firstExecutionError(result),
      inviteId,
      attempt,
    };
  }

  if (Number(result?.skipped || 0) > 0) {
    // Destinatário inválido/sem WhatsApp: encerra sem novas tentativas a cada cron.
    await releaseClaim({ reminder_5d_attempts: MAX_INVITE_REMINDER_ATTEMPTS, reminder_5d_last_error: firstExecutionError(result) });
    return { status: 'skipped', reason: 'recipient_skipped', inviteId };
  }

  // Nenhuma regra ativa no momento do envio: devolve o convite ao estado anterior.
  await releaseClaim({ reminder_5d_claimed_at: null, reminder_5d_attempts: previousAttempts });
  return { status: 'skipped', reason: 'no_active_rule', inviteId };
}

/** Convites elegíveis ao lembrete em um workspace (eventos futuros, pendentes, vencidos). */
export async function getInviteReminderCandidates({ supabaseAdmin = getSupabaseAdmin(), rule, workspaceId, now = new Date() }) {
  if (!workspaceId) return [];

  const { data: events, error: eventsError } = await supabaseAdmin
    .from('events')
    .select('id, workspace_id, event_date, status')
    .eq('workspace_id', workspaceId)
    .gte('event_date', todayInSaoPaulo(now));
  if (eventsError) throw eventsError;
  if (!events?.length) return [];

  const eventsById = new Map(events.map((event) => [String(event.id), event]));
  const { data: invites, error: invitesError } = await supabaseAdmin
    .from('invites')
    .select('id, event_id, status, sent_at, whatsapp_sent_at, reminder_5d_claimed_at, reminder_5d_sent_at, reminder_5d_attempts')
    .in('event_id', [...eventsById.keys()])
    .eq('status', 'pending')
    .is('reminder_5d_sent_at', null)
    .is('reminder_5d_claimed_at', null);
  if (invitesError) throw invitesError;

  const days = resolveReminderDays(rule);
  return (invites || [])
    .filter((invite) =>
      evaluateInviteReminder(
        { ...invite, event: eventsById.get(String(invite.event_id)) },
        { days, workspaceId, now }
      ).due
    )
    .map((invite) => invite.id);
}
