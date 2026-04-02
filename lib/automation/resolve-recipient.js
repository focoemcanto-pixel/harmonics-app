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

  // Tipos baseados em evento (entityId = event_id) com destinatário cliente
  const CLIENT_EVENT_TYPES = [
    'repertoire_pending_15_days_client',
    'payment_pending_2_days_client',
    'post_event_review_request_client',
  ];

  if (CLIENT_EVENT_TYPES.includes(eventType)) {
    // Buscar evento
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, client_name, event_date, event_time, location_name')
      .eq('id', entityId)
      .maybeSingle();

    if (eventError || !event) {
      throw new Error(`Evento não encontrado para entityId: ${entityId}`);
    }

    // Buscar pré-contrato pelo evento para obter telefone e token do cliente
    const { data: precontract, error: pcError } = await supabaseAdmin
      .from('precontracts')
      .select('id, public_token, client_name, client_phone, status')
      .eq('event_id', entityId)
      .not('client_phone', 'is', null)
      .neq('client_phone', '')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pcError || !precontract) {
      throw new Error(`Pré-contrato com telefone não encontrado para evento: ${entityId}`);
    }

    const phone = cleanPhone(precontract.client_phone);
    if (!phone) {
      throw new Error('Cliente sem telefone no pré-contrato');
    }

    return {
      recipientNumber: phone,
      recipientType: 'client',
      recipientName: precontract.client_name || event.client_name || null,
      contextData: { event, precontract },
    };
  }

  // Tipo baseado em evento com destinatário admin
  if (eventType === 'schedule_pending_15_days_admin') {
    // Buscar evento
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, client_name, event_date, event_time, location_name')
      .eq('id', entityId)
      .maybeSingle();

    if (eventError || !event) {
      throw new Error(`Evento não encontrado para entityId: ${entityId}`);
    }

    // Telefone do admin via variável de ambiente
    const adminPhone = cleanPhone(process.env.ADMIN_WHATSAPP_PHONE || '');
    if (!adminPhone) {
      throw new Error(
        'ADMIN_WHATSAPP_PHONE não configurada — necessária para automações de admin'
      );
    }

    // Buscar convites pendentes para contexto
    const { data: pendingInvites } = await supabaseAdmin
      .from('invites')
      .select('id, suggested_role_name, status, contact:contacts(name)')
      .eq('event_id', entityId)
      .eq('status', 'pending');

    return {
      recipientNumber: adminPhone,
      recipientType: 'admin',
      recipientName: 'Admin',
      contextData: { event, pendingInvites: pendingInvites || [] },
    };
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
