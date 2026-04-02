import { getSupabaseAdmin } from '../supabase-admin';

/**
 * Resolve destinatário baseado no tipo de evento e entidade
 * @param {string} eventType
 * @param {string} entityId
 * @param {Object} rule
 * @returns {Promise<Object>} { recipientNumber, recipientType, recipientName, contextData }
 */
export async function resolveRecipient(eventType, entityId, rule) {
  const supabaseAdmin = getSupabaseAdmin();

  function cleanPhone(value) {
    return String(value || '').replace(/\D/g, '');
  }

  if (eventType === 'invite_member') {
    const { data: invite, error } = await supabaseAdmin
      .from('invites')
      .select(
        `id, event_id, contact_id, suggested_role_name, status, invite_token,
         contact:contacts(id, name, phone, email),
         event:events(id, client_name, event_date, event_time, location_name)`
      )
      .eq('id', entityId)
      .single();

    if (error || !invite) {
      throw new Error(`Invite não encontrado para entityId: ${entityId}`);
    }

    const phone = cleanPhone(invite.contact?.phone);
    if (!phone) {
      throw new Error('Contato do invite sem telefone');
    }

    return {
      recipientNumber: phone,
      recipientType: 'member',
      recipientName: invite.contact?.name || null,
      contextData: { invite },
    };
  }

  if (eventType === 'contract_signed_client') {
    // Tentar buscar como precontract diretamente
    const { data: precontract, error: pcError } = await supabaseAdmin
      .from('precontracts')
      .select('id, public_token, client_name, client_phone, status')
      .eq('id', entityId)
      .maybeSingle();

    if (!pcError && precontract) {
      const phone = cleanPhone(precontract.client_phone);
      if (!phone) {
        throw new Error('Cliente sem telefone no pré-contrato');
      }
      return {
        recipientNumber: phone,
        recipientType: 'client',
        recipientName: precontract.client_name || null,
        contextData: { precontract },
      };
    }

    // Tentar buscar como contract.id
    const { data: contract, error: cError } = await supabaseAdmin
      .from('contracts')
      .select(
        `id, precontract_id, status,
         precontract:precontracts(id, public_token, client_name, client_phone)`
      )
      .eq('id', entityId)
      .maybeSingle();

    if (cError || !contract) {
      throw new Error(`Entidade não encontrada para entityId: ${entityId}`);
    }

    const precontractData = contract.precontract;
    const phone = cleanPhone(precontractData?.client_phone);
    if (!phone) {
      throw new Error('Cliente sem telefone no contrato');
    }

    return {
      recipientNumber: phone,
      recipientType: 'client',
      recipientName: precontractData?.client_name || null,
      contextData: { contract, precontract: precontractData },
    };
  }

  throw new Error(`Tipo de evento não suportado: ${eventType}`);
}
