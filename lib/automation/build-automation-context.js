import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from '../supabase-admin';

/**
 * Monta variáveis de contexto para renderização de template
 * @param {string} eventType
 * @param {string} entityId
 * @param {Object} recipientData - dados retornados por resolveRecipient
 * @returns {Promise<Object>} contexto com variáveis
 */
export async function buildAutomationContext(eventType, entityId, recipientData) {
  const baseUrl = process.env.APP_BASE_URL || '';

  function formatDateBR(value) {
    if (!value) return '';
    const [y, m, d] = String(value).split('-');
    if (!y || !m || !d) return value;
    return `${d}/${m}/${y}`;
  }

  function formatTime(value) {
    return value ? String(value).slice(0, 5) : '';
  }

  const context = {};

  if (eventType === 'invite_member') {
    const { invite } = recipientData.contextData || {};
    if (!invite) return context;

    const event = invite.event || {};

    // Garantir que o token de convite existe
    let inviteToken = invite.invite_token;
    if (!inviteToken) {
      // Gerar token caso não exista
      const supabaseAdmin = getSupabaseAdmin();
      inviteToken = randomUUID();
      await supabaseAdmin
        .from('invites')
        .update({ invite_token: inviteToken })
        .eq('id', invite.id);
    }

    context['{cliente_nome}'] = invite.contact?.name || '';
    context['{evento_nome}'] = event.client_name || '';
    context['{evento_data}'] = formatDateBR(event.event_date);
    context['{evento_horario}'] = formatTime(event.event_time);
    context['{evento_local}'] = event.location_name || '';
    context['{link_painel_cliente}'] = inviteToken
      ? `${baseUrl}/membro/${inviteToken}`
      : '';
    // Alias link_convite para compatibilidade
    context['{link_convite}'] = context['{link_painel_cliente}'];

    return context;
  }

  if (eventType === 'contract_signed_client') {
    const { precontract } = recipientData.contextData || {};
    if (!precontract) return context;

    context['{cliente_nome}'] = precontract.client_name || '';
    context['{link_painel_cliente}'] = precontract.public_token
      ? `${baseUrl}/cliente/${precontract.public_token}`
      : '';

    return context;
  }

  return context;
}
