import { getSupabaseAdmin } from '../supabase-admin';
import { resolveWorkspaceSettings } from './get-workspace';

/**
 * Registra disparo de mensagem em automation_logs
 * @param {Object} params
 * @param {string} params.workspaceId - ID do workspace
 * @param {string} params.ruleId - ID da regra (null se manual)
 * @param {string} params.templateId - ID do template (null se hardcoded)
 * @param {string} params.channelId - ID do canal (null se env vars)
 * @param {string} params.entityId - ID da entidade (invite.id, contract.id)
 * @param {string} params.entityType - Tipo da entidade ('invite', 'contract')
 * @param {string} params.recipientType - Tipo destinatário ('member', 'client', 'admin')
 * @param {string} params.recipient - Número do destinatário
 * @param {string} params.renderedMessage - Mensagem enviada
 * @param {Object} params.metadata - Dados contextuais (event, contact, etc)
 * @param {Object} params.providerResponse - Resposta da API WhatsApp
 * @param {string} params.status - Status ('sent', 'failed', 'skipped')
 * @param {string} params.errorMessage - Mensagem de erro (se houver)
 * @param {string} params.source - Origem ('legacy_send_invite', 'legacy_contract_signed')
 * @returns {Promise<{ok: boolean}>}
 */
export async function logAutomationDispatch({
  workspaceId,
  ruleId,
  templateId,
  channelId,
  entityId,
  entityType,
  recipientType,
  recipient,
  renderedMessage,
  metadata,
  providerResponse,
  status,
  errorMessage,
  source,
}) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const workspace = await resolveWorkspaceSettings(workspaceId);

    const { error } = await supabaseAdmin.from('automation_logs').insert({
      workspace_id: workspace.id,
      rule_id: ruleId,
      template_id: templateId,
      channel_id: channelId,
      entity_id: entityId,
      entity_type: entityType,
      recipient_type: recipientType,
      recipient,
      rendered_message: renderedMessage,
      metadata,
      provider_response: providerResponse,
      status,
      error_message: errorMessage,
      source,
    });

    if (error) {
      console.error('[logAutomationDispatch] Erro ao registrar log de automação:', error);
      return { ok: false };
    }

    return { ok: true };
  } catch (err) {
    console.error('[logAutomationDispatch] Exceção ao registrar log de automação:', err);
    return { ok: false };
  }
}
