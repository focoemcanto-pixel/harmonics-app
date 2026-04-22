import { getSupabaseAdmin } from '../supabase-admin';

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidPhone(value) {
  const digits = cleanPhone(value);
  return digits.length >= 10 && digits.length <= 13;
}

/**
 * Resolve telefone de cliente por prioridade:
 * 1) telefone principal do contrato/pré-contrato
 * 2) telefone do contato vinculado ao evento
 * 3) fallback de telefone salvo no evento
 */
export async function resolveClientWhatsAppTarget({
  eventId = null,
  precontractId = null,
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const debug = {
    priorityAttempted: [],
  };

  let event = null;
  if (eventId) {
    const { data: eventData } = await supabaseAdmin
      .from('events')
      .select('id, client_name, event_date, event_time, location_name, client_contact_id, whatsapp_phone')
      .eq('id', eventId)
      .maybeSingle();
    event = eventData || null;
  }

  let precontract = null;
  if (precontractId) {
    const { data: precontractData } = await supabaseAdmin
      .from('precontracts')
      .select('id, event_id, public_token, client_name, client_phone, status, created_at')
      .eq('id', precontractId)
      .maybeSingle();
    precontract = precontractData || null;
  } else if (eventId) {
    const { data: latestPrecontract } = await supabaseAdmin
      .from('precontracts')
      .select('id, event_id, public_token, client_name, client_phone, status, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    precontract = latestPrecontract || null;
  }

  // Prioridade 1: telefone principal do contrato/pré-contrato
  const precontractPhone = cleanPhone(precontract?.client_phone);
  debug.priorityAttempted.push({
    priority: 1,
    source: 'precontract.client_phone',
    hasValue: !!precontractPhone,
  });
  if (isValidPhone(precontractPhone)) {
    return {
      phone: precontractPhone,
      event,
      precontract,
      source: 'precontract.client_phone',
      debug,
    };
  }

  // Prioridade 2: telefone do contato vinculado ao evento
  if (event?.client_contact_id) {
    const { data: contact } = await supabaseAdmin
      .from('contacts')
      .select('id, name, phone, email')
      .eq('id', event.client_contact_id)
      .maybeSingle();

    const contactPhone = cleanPhone(contact?.phone);
    debug.priorityAttempted.push({
      priority: 2,
      source: 'events.client_contact_id -> contacts.phone',
      hasValue: !!contactPhone,
    });
    if (isValidPhone(contactPhone)) {
      return {
        phone: contactPhone,
        event,
        precontract,
        contact,
        source: 'contact.phone',
        debug,
      };
    }
  } else {
    debug.priorityAttempted.push({
      priority: 2,
      source: 'events.client_contact_id -> contacts.phone',
      hasValue: false,
    });
  }

  // Prioridade 3: fallback válido no evento
  const eventFallbackPhone = cleanPhone(event?.whatsapp_phone);
  debug.priorityAttempted.push({
    priority: 3,
    source: 'events.whatsapp_phone',
    hasValue: !!eventFallbackPhone,
  });
  if (isValidPhone(eventFallbackPhone)) {
    return {
      phone: eventFallbackPhone,
      event,
      precontract,
      source: 'event.whatsapp_phone',
      debug,
    };
  }

  return {
    phone: null,
    event,
    precontract,
    source: null,
    debug,
  };
}
