import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  PRECONTRACT_EXPIRED_MESSAGE,
  expirePrecontractIfNeeded,
  isPrecontractExpiredStatus,
} from '@/lib/contracts/precontract-expiration';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function asString(value) {
  return String(value || '').trim();
}

function extractToken(params) {
  if (Array.isArray(params?.token)) return asString(params.token[0]);
  return asString(params?.token);
}

function pickPrecontract(precontract) {
  if (!precontract) return null;

  return {
    id: precontract.id,
    workspace_id: precontract.workspace_id || null,
    created_at: precontract.created_at || null,
    public_token: precontract.public_token || null,
    generated_link: precontract.generated_link || null,
    status: precontract.status || null,

    client_name: precontract.client_name || null,
    client_email: precontract.client_email || null,
    client_phone: precontract.client_phone || null,

    event_type: precontract.event_type || null,
    event_type_id: precontract.event_type_id || null,
    event_date: precontract.event_date || null,
    event_time: precontract.event_time || null,
    duration_min: precontract.duration_min ?? null,
    location_name: precontract.location_name || null,
    location_address: precontract.location_address || null,

    formation: precontract.formation || null,
    instruments: precontract.instruments || null,
    reception_formation: precontract.reception_formation || null,
    reception_instruments: precontract.reception_instruments || null,

    has_sound: precontract.has_sound === true,
    reception_hours: precontract.reception_hours ?? 0,
    has_transport: precontract.has_transport === true,

    base_amount: precontract.base_amount ?? null,
    add_reception: precontract.add_reception ?? null,
    add_sound: precontract.add_sound ?? null,
    add_transport: precontract.add_transport ?? null,
    value: precontract.value ?? null,
    agreed_amount: precontract.agreed_amount ?? null,
    signal_amount: precontract.signal_amount ?? null,
    remaining_amount: precontract.remaining_amount ?? null,
    payment_method: precontract.payment_method || null,
    signal_due_date: precontract.signal_due_date || null,
    balance_due_date: precontract.balance_due_date || null,
    card_due_date: precontract.card_due_date || null,
    payment_card: precontract.payment_card === true,

    notes: precontract.notes || null,
    event_id: precontract.event_id || null,
    contact_id: precontract.contact_id || null,

    contract_mode: precontract.contract_mode || null,
    contract_template_id: precontract.contract_template_id || null,
    custom_contract_enabled: precontract.custom_contract_enabled === true,
    custom_contract_title: precontract.custom_contract_title || null,
    custom_contract_content: precontract.custom_contract_content || null,
    custom_contract_rich_html: precontract.custom_contract_rich_html || null,
    contract_template_text: precontract.contract_template_text || null,
  };
}

function pickContract(contract) {
  if (!contract) return null;

  const rawPayload = contract.raw_payload || {};
  const clientForm = rawPayload.client_form || null;

  return {
    id: contract.id,
    workspace_id: contract.workspace_id || null,
    precontract_id: contract.precontract_id || null,
    public_token: contract.public_token || null,
    status: contract.status || null,
    signed_at: contract.signed_at || null,
    signature_name: contract.signature_name || null,
    pdf_url: contract.pdf_url || null,
    doc_url: contract.doc_url || null,
    contact_id: contract.contact_id || null,
    event_id: contract.event_id || null,
    raw_payload: clientForm
      ? {
          client_form: clientForm,
          signed_contract_mode: rawPayload.signed_contract_mode || null,
          final_generation: rawPayload.final_generation || null,
        }
      : {
          signed_contract_mode: rawPayload.signed_contract_mode || null,
          final_generation: rawPayload.final_generation || null,
        },
  };
}

function pickContact(contact) {
  if (!contact) return null;

  return {
    id: contact.id,
    name: contact.name || null,
    email: contact.email || null,
    phone: contact.phone || null,
    cpf_cnpj: contact.cpf_cnpj || null,
    notes: contact.notes || null,
  };
}\n
function pickEvent(event) {
  if (!event) return null;

  return {
    id: event.id,
    workspace_id: event.workspace_id || null,
    contact_id: event.contact_id || null,
    client_contact_id: event.client_contact_id || null,
    client_name: event.client_name || null,

    event_type: event.event_type || null,
    event_date: event.event_date || null,
    event_time: event.event_time || null,
    duration_min: event.duration_min ?? null,
    location_name: event.location_name || null,
    location_address: event.location_address || null,

    agreed_amount: event.agreed_amount ?? null,
    formation: event.formation || null,
    instruments: event.instruments || null,
    reception_formation: event.reception_formation || null,
    reception_instruments: event.reception_instruments || null,
    has_sound: event.has_sound === true,
    reception_hours: event.reception_hours ?? 0,
    has_transport: event.has_transport === true,

    signal_due_date: event.signal_due_date || null,
    balance_due_date: event.balance_due_date || null,
    card_due_date: event.card_due_date || null,
    payment_card: event.payment_card === true,
  };
}

export async function GET(_request, context) {
  const params = await context?.params;
  const token = extractToken(params);

  if (!token) {
    return NextResponse.json({ ok: false, message: 'Token inválido.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: rawPrecontract, error: preError } = await supabase
      .from('precontracts')
      .select('*')
      .eq('public_token', token)
      .maybeSingle();

    if (preError) throw preError;

    if (!rawPrecontract?.id) {
      return NextResponse.json({ ok: false, message: 'Contrato não encontrado.' }, { status: 404 });
    }

    const expiration = await expirePrecontractIfNeeded({ supabase, precontract: rawPrecontract });
    const precontract = expiration?.precontract || rawPrecontract;

    if (isPrecontractExpiredStatus(precontract)) {
      return NextResponse.json(
        {
          ok: false,
          expired: true,
          message: PRECONTRACT_EXPIRED_MESSAGE,
          precontract: pickPrecontract(precontract),
        },
        { status: 410 }
      );
    }

    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('precontract_id', precontract.id)
      .maybeSingle();

    if (contractError) throw contractError;

    const contactId = contract?.contact_id || precontract?.contact_id || null;
    const eventId = contract?.event_id || precontract?.event_id || null;

    let contact = null;
    if (contactId) {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .maybeSingle();

      if (!error) {
        contact = data || null;
      }
    }

    let event = null;
    if (eventId) {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();

      if (!error) {
        event = data || null;
      }
    }

    const contractState = pickContract(contract);
    const precontractState = pickPrecontract(precontract);
    const isSigned = contractState?.status === 'signed' || precontractState?.status === 'signed';

    return NextResponse.json({
      ok: true,
      found: true,
      token,
      signed: isSigned,
      precontract: precontractState,
      contract: contractState,
      contact: pickContact(contact),
      event: pickEvent(event),
      signature: isSigned
        ? {
            status: contractState?.status || precontractState?.status || 'signed',
            signed_at: contractState?.signed_at || null,
            pdf_url: contractState?.pdf_url || null,
            doc_url: contractState?.doc_url || null,
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error?.message || 'Erro ao buscar contrato público.' },
      { status: 500 }
    );
  }
}
