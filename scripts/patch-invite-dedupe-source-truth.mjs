import fs from 'node:fs';

const path = 'lib/automation/execute-automation-event.js';
let source = fs.readFileSync(path, 'utf8');
const marker = "const isDuplicate = eventType === 'invite_member' ? false : await checkAutomationDuplicate(";

if (!source.includes(marker)) {
  const oldText = `      const isDuplicate = await checkAutomationDuplicate(
        workspaceId,
        rule.id,
        entityId,
        recipientData.recipientNumber
      );`;

  const newText = `      // Convites possuem uma fonte de verdade própria para idempotência:
      // invites.whatsapp_sent_at + o lock de envio do sendInviteService.
      // Não podemos usar automation_logs para bloquear invite_member, porque um
      // convite removido e reativado mantém o mesmo ID e um log histórico "sent"
      // impediria um novo disparo mesmo após whatsapp_sent_at ser resetado.
      const isDuplicate = eventType === 'invite_member'
        ? false
        : await checkAutomationDuplicate(
            workspaceId,
            rule.id,
            entityId,
            recipientData.recipientNumber
          );`;

  if (!source.includes(oldText)) {
    throw new Error('[invite dedupe patch] Trecho de deduplicação esperado não encontrado.');
  }

  source = source.replace(oldText, newText);
  fs.writeFileSync(path, source);
  console.log('[invite dedupe patch] execute-automation-event.js atualizado');
} else {
  console.log('[invite dedupe patch] já aplicado');
}
