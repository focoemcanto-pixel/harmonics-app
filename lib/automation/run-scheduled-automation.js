import { executeAutomationEvent } from './execute-automation-event';

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
export async function runScheduledAutomation(eventType, entityIds, workspaceId) {
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
