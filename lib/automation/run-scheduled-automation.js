import { executeAutomationEvent } from './execute-automation-event';
import { INVITE_REMINDER_EVENT_TYPE } from './invite-dispatch';
import { sendInviteReminderService } from '../whatsapp/send-invite-reminder-service';

async function runInviteReminders(entityIds, workspaceId, rule) {
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const executions = [];
  for (const inviteId of entityIds) {
    try {
      const result = await sendInviteReminderService({ inviteId, workspaceId, rule });
      if (result.status === 'sent') sent++;
      else if (result.status === 'failed') failed++;
      else skipped++;
      executions.push({ eventType: INVITE_REMINDER_EVENT_TYPE, entityId: inviteId, ...result });
    } catch (err) {
      console.error(`[runScheduledAutomation] Erro no lembrete do convite ${inviteId}:`, err);
      failed++;
      executions.push({ eventType: INVITE_REMINDER_EVENT_TYPE, entityId: inviteId, status: 'failed', error: err?.message || 'Erro desconhecido' });
    }
  }
  return { sent, skipped, failed, executions };
}

/**
 * Executa automação agendada para uma lista de candidatos.
 *
 * Chama o motor central (executeAutomationEvent) para cada entityId,
 * que é responsável por resolver regra, template, canal, verificar
 * duplicidade, enviar e logar.
 *
 * @param {string} eventType - tipo do evento de automação
 * @param {string[]} entityIds - lista de IDs das entidades elegíveis
 * @param {string} workspaceId - ID do workspace
 * @returns {Promise<{ sent: number, skipped: number, failed: number, executions: Array }>}
 */
export async function runScheduledAutomation(eventType, entityIds, workspaceId, { rule = null } = {}) {
  // Lembrete de convite tem idempotência própria por convite (reivindicação atômica).
  if (eventType === INVITE_REMINDER_EVENT_TYPE) return runInviteReminders(entityIds, workspaceId, rule);

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const executions = [];

  for (const entityId of entityIds) {
    try {
      const result = await executeAutomationEvent({
        eventType,
        entityId,
        workspaceId,
        origin: 'cron',
      });

      sent += result.sent || 0;
      skipped += result.skipped || 0;
      failed += result.failed || 0;
      executions.push(...(result.executions || []));
    } catch (err) {
      console.error(
        `[runScheduledAutomation] Erro em ${eventType} para entityId=${entityId}:`,
        err
      );
      failed++;
      executions.push({
        eventType,
        entityId,
        status: 'failed',
        error: err?.message || 'Erro desconhecido',
      });
    }
  }

  return { sent, skipped, failed, executions };
}
