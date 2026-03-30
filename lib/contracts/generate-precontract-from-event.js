import { supabase } from '../supabase';

function generateToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function buildContractLink(token) {
  if (typeof window === 'undefined') return `/contrato/${token}`;
  return `${window.location.origin}/contrato/${token}`;
}

export async function generatePrecontractFromEvent(event) {
  if (!event?.id) {
    throw new Error('Evento inválido');
  }

  // 🔎 1. Verifica se já existe precontract
  const { data: existing } = await supabase
    .from('precontracts')
    .select('*')
    .eq('event_id', event.id)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  // 🔧 2. Monta payload baseado no evento
  const token = generateToken();
  const link = buildContractLink(token);

  const payload = {
    event_id: event.id,

    client_name: event.client_name || null,
    client_email: event.client_email || null,
    client_phone: event.client_phone || null,

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
    has_transport: !!event.has_transport,

    base_amount: event.base_amount || 0,
    add_reception: event.add_reception || 0,
    add_sound: event.add_sound || 0,
    add_transport: event.add_transport || 0,
    agreed_amount: event.agreed_amount || 0,

    notes: event.notes || null,

    status: 'link_generated',

    public_token: token,
    generated_link: link,
  };

  // 💾 3. Cria precontract
  const { data, error } = await supabase
    .from('precontracts')
    .insert([payload])
    .select('*')
    .single();

  if (error) {
    console.error('Erro ao criar precontract:', error);
    throw error;
  }

  return data;
}
