import { supabase } from '../supabase';

function generateToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function buildContractLink(token) {
  if (typeof window === 'undefined') return `/contrato/${token}`;
  return `${window.location.origin}/contrato/${token}`;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function generatePrecontractFromEvent(event) {
  if (!event?.id) {
    throw new Error('Evento inválido para gerar contrato.');
  }

  const { data: existing, error: existingError } = await supabase
    .from('precontracts')
    .select('*')
    .eq('event_id', event.id)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing;
  }

  const token = generateToken();
  const link = buildContractLink(token);

  const payload = {
    contact_id: event.client_contact_id || null,
    event_id: event.id,

    client_name: event.client_name || null,
    client_email: null,
    client_phone: event.whatsapp_phone || null,

    event_type: event.event_type || null,
    event_date: event.event_date || null,
    event_time: event.event_time || null,
    duration_min: event.duration_min || 60,

    location_name: event.location_name || null,
    location_address: event.location_address || null,

    formation: event.formation || null,
    instruments: event.instruments || null,

    has_sound: !!event.has_sound,
    reception_hours: event.reception_hours || 0,
    has_transport: toNumber(event.transport_price) > 0,

    base_amount: toNumber(event.formation_price),
    add_reception: toNumber(event.reception_price),
    add_sound: toNumber(event.sound_price),
    add_transport: toNumber(event.transport_price),
    agreed_amount: toNumber(event.agreed_amount),

    notes: event.observations || null,

    public_token: token,
    generated_link: link,
    status: 'link_generated',
  };

  const { data, error } = await supabase
    .from('precontracts')
    .insert([payload])
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}
