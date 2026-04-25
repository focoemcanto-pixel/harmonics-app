import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

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
    public_token: precontract.public_token || null,
    status: precontract.status || null,
    client_name: precontract.client_name || null,
    client_email: precontract.client_email || null,
    client_phone: precontract.client_phone || null,
    event_date: precontract.event_date || null,
    event_time: precontract.event_time || null,
    location_name: precontract.location_name || null,
    location_address: precontract.location_address || null,
    notes: precontract.notes || null,
    event_id: precontract.event_id || null,
    contact_id: precontract.contact_id || null,
    value: precontract.value ?? null,
    agreed_amount: precontract.agreed_amount ?? null,
    formation: precontract.formation || null,
    contract_mode: precontract.contract_mode || null,
    custom_contract_enabled: precontract.custom_contract_enabled === true,
    custom_contract_title: precontract.custom_contract_title || null,
    custom_contract_content: precontract.custom_contract_content || null,
    contract_template_text: precontract.contract_template_text || null,
  };
}

function pickContract(contract) {
  if (!contract) return null;

  const rawPayload = contract.raw_payload || {};
  const clientForm = rawPayload.client_form || null;

  return {
    id: contract.id,
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
}

function pickEvent(event) {
  if (!event) return null;

  return {
    id: event.id,
    contact_id: event.contact_id || null,
    client_name: event.client_name || null,
    event_date: event.event_date || null,
    event_time: event.event_time || null,
    location_name: event.location_name || null,
    location_address: event.location_address || null,
    agreed_amount: event.agreed_amount ?? null,
    formation: event.formation || null,
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

    const { data: precontract, error: preError } = await supabase
      .from('precontracts')
      .select('*')
      .eq('public_token', token)
      .maybeSingle();

    if (preError) throw preError;

    if (!precontract?.id) {
      return NextResponse.json({ ok: false, message: 'Contrato não encontrado.' }, { status: 404 });
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
    const isSigned =
      contractState?.status === 'signed' ||
      precontractState?.status === 'signed';

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
      {
        ok: false,
        message: error?.message || 'Erro ao buscar contrato público.',
      },
      { status: 500 }
    );
  }
}
