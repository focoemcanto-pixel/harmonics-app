import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateRequiredEnv } from '@/lib/config/validate-env';
import { getAutomaticCosts } from '@/lib/eventos/eventos-finance';
import { normalizeTimeStrict } from '@/lib/time/normalize-time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const asString = (v) => String(v || '').trim();
const cleanDigits = (v) => asString(v).replace(/\D/g, '');
const normalizeTime = (value) => normalizeTimeStrict(asString(value)) || null;
const brToIsoDate = (value) => {
  const raw = asString(value);
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return raw || null;
  return `${m[3]}-${m[2]}-${m[1]}`;
};



const pickDefined = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && (!(typeof value === 'string') || value.trim() !== '')) {
      return value;
    }
  }
  return null;
};

function extractToken(params) {
  if (Array.isArray(params?.token)) return asString(params.token[0]);
  return asString(params?.token);
}

async function upsertContactFromSignature({ supabase, precontract, form }) {
  const email = asString(precontract?.client_email) || null;
  const phone = cleanDigits(form?.whatsapp) || null;
  const name = asString(form?.full_name) || null;

  const isMissingContactTypeColumnError = (error) => {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('contact_type') && message.includes('contacts');
  };

  let existing = null;
  if (email) {
    const { data } = await supabase.from('contacts').select('id').eq('email', email).maybeSingle();
    existing = data || null;
  }
  if (!existing && phone) {
    const { data } = await supabase.from('contacts').select('id').eq('phone', phone).maybeSingle();
    existing = data || null;
  }

  const payload = {
    name,
    email,
    phone,
    tag: 'cliente',
    contact_type: 'client',
    notes: [
      'Criado/atualizado automaticamente após assinatura.',
      precontract?.event_type ? `Tipo: ${precontract.event_type}` : '',
      precontract?.formation ? `Formação: ${precontract.formation}` : '',
    ].filter(Boolean).join(' | '),
    is_active: true,
  };

  if (existing?.id) {
    let { error } = await supabase.from('contacts').update(payload).eq('id', existing.id);
    if (error && isMissingContactTypeColumnError(error)) {
      const retryPayload = { ...payload };
      delete retryPayload.contact_type;
      const retry = await supabase.from('contacts').update(retryPayload).eq('id', existing.id);
      error = retry.error || null;
    }
    if (error) throw error;
    return existing.id;
  }

  let { data, error } = await supabase.from('contacts').insert([payload]).select('id').single();
  if (error && isMissingContactTypeColumnError(error)) {
    const retryPayload = { ...payload };
    delete retryPayload.contact_type;
    const retry = await supabase.from('contacts').insert([retryPayload]).select('id').single();
    data = retry.data || null;
    error = retry.error || null;
  }
  if (error) throw error;
  return data.id;
}

async function upsertEventFromSignature({ supabase, precontract, contactId, form }) {
  const { data: financeDefaults } = await supabase.from('finance_cost_defaults').select('musician_unit_cost, sound_default_cost, transport_default_cost, other_default_cost, custom_costs').eq('slug', 'default').maybeSingle();
  const automaticCosts = getAutomaticCosts({
    formation: precontract?.formation,
    hasSound: !!precontract?.has_sound,
    hasTransport: !!precontract?.has_transport,
    transportPrice: precontract?.add_transport || 0,
    pricing: financeDefaults || {},
  });
  const agreedAmount = Number(precontract?.agreed_amount || 0);
  const totalCosts = Number(automaticCosts.musicianCost || 0) + Number(automaticCosts.soundCost || 0) + Number(automaticCosts.extraTransportCost || 0) + Number(automaticCosts.otherCost || 0);
  const profitAmount = agreedAmount - totalCosts;

  const safeDate = brToIsoDate(form?.event_date) || precontract?.event_date || null;
  const safeTime = normalizeTime(form?.event_time) || normalizeTime(precontract?.event_time) || null;
  const safeClientName = asString(form?.full_name) || asString(precontract?.client_name) || null;
  const safeLocationName = asString(form?.event_location_name) || asString(precontract?.location_name) || null;
  const safeLocationAddress = asString(form?.event_location_address) || asString(precontract?.location_address) || null;

  const payload = {
    client_contact_id: contactId || null,
    client_name: safeClientName,
    event_type: precontract?.event_type || null,
    event_date: safeDate,
    event_time: safeTime,
    duration_min: Number(precontract?.duration_min || 60),
    location_name: safeLocationName,
    location_address: safeLocationAddress,
    formation: precontract?.formation || null,
    instruments: precontract?.instruments || null,
    reception_formation: precontract?.reception_formation || null,
    reception_instruments: precontract?.reception_instruments || null,
    has_sound: !!precontract?.has_sound,
    reception_hours: Number(precontract?.reception_hours || 0),
    has_transport: !!precontract?.has_transport,
    transport_cost: Number(precontract?.add_transport || 0),
    base_amount: Number(precontract?.base_amount || 0),
    agreed_amount: agreedAmount,
    gross_amount: agreedAmount,
    net_amount: profitAmount,
    profit_amount: profitAmount,
    musician_cost: Number(automaticCosts.musicianCost || 0),
    sound_cost: Number(automaticCosts.soundCost || 0),
    extra_transport_cost: Number(automaticCosts.extraTransportCost || 0),
    other_cost: Number(automaticCosts.otherCost || 0),
    cost_breakdown: automaticCosts.costBreakdown,
    costs_source: 'default',
    whatsapp_name: safeClientName,
    whatsapp_phone: cleanDigits(form?.whatsapp) || null,
    notes: ['Criado/atualizado automaticamente após assinatura.', precontract?.notes || ''].filter(Boolean).join('\n\n'),
    status: 'Confirmado',
    legacy_id: asString(precontract?.legacy_id) || null,
  };

  let finalEventId = precontract?.event_id || null;
  if (finalEventId) {
    const { error } = await supabase.from('events').update(payload).eq('id', finalEventId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from('events').insert([payload]).select('id').single();
    if (error) throw error;
    finalEventId = data?.id || null;
  }
  return finalEventId;
}

export async function POST(request, context) {
  const params = await context?.params;
  const token = extractToken(params);
  validateRequiredEnv('public/contracts-sign');
  if (!token) return NextResponse.json({ ok: false, message: 'Token inválido.' }, { status: 400 });

  try {
    const body = await request.json().catch(() => null);
    const form = body?.form || body || {};
    const supabase = getSupabaseAdmin();

    const { data: precontract, error: preError } = await supabase.from('precontracts').select('*').eq('public_token', token).maybeSingle();
    if (preError) throw preError;
    if (!precontract?.id) return NextResponse.json({ ok: false, message: 'Contrato não encontrado.' }, { status: 404 });

    let { data: contract } = await supabase.from('contracts').select('*').eq('precontract_id', precontract.id).maybeSingle();
    if (!contract?.id) {
      const inserted = await supabase.from('contracts').insert({
        precontract_id: precontract.id,
        public_token: precontract.public_token || token,
        status: 'client_filling',
        contact_id: precontract.contact_id || null,
        event_id: precontract.event_id || null,
        agreed_amount: precontract.agreed_amount ?? null,
        base_amount: precontract.base_amount ?? null,
      }).select('*').single();
      if (inserted.error) throw inserted.error;
      contract = inserted.data;
    }

    const contactId = await upsertContactFromSignature({ supabase, precontract, form });
    const eventId = await upsertEventFromSignature({ supabase, precontract, contactId, form });

    const payloadPre = {
      client_name: asString(form.full_name) || precontract.client_name || null,
      client_email: precontract.client_email || null,
      client_phone: cleanDigits(form.whatsapp) || precontract.client_phone || null,
      event_date: pickDefined(brToIsoDate(form.event_date), precontract.event_date),
      event_time: pickDefined(normalizeTime(form.event_time), normalizeTime(precontract.event_time)),
      location_name: asString(form.event_location_name) || precontract.location_name || null,
      location_address: asString(form.event_location_address) || precontract.location_address || null,
      event_id: eventId || precontract.event_id || null,
      contact_id: contactId || precontract.contact_id || null,
      status: 'client_filling',
    };
    const { error: upPre } = await supabase.from('precontracts').update(payloadPre).eq('id', precontract.id);
    if (upPre) throw upPre;

    const assinaturaEm = new Date().toISOString();
    const existingClientForm = contract?.raw_payload?.client_form || {};
    const clientForm = {
      full_name: pickDefined(asString(form.full_name), existingClientForm.full_name),
      marital_status: pickDefined(asString(form.marital_status), existingClientForm.marital_status),
      profession: pickDefined(asString(form.profession), existingClientForm.profession),
      cpf: pickDefined(cleanDigits(form.cpf), existingClientForm.cpf),
      rg: pickDefined(asString(form.rg), existingClientForm.rg),
      whatsapp: pickDefined(cleanDigits(form.whatsapp), existingClientForm.whatsapp),
      address_street: pickDefined(asString(form.address_street), existingClientForm.address_street),
      address_number: pickDefined(asString(form.address_number), existingClientForm.address_number),
      address_complement: pickDefined(asString(form.address_complement), existingClientForm.address_complement),
      address_neighborhood: pickDefined(asString(form.address_neighborhood), existingClientForm.address_neighborhood),
      address_cep: pickDefined(cleanDigits(form.address_cep), existingClientForm.address_cep),
      address_city: pickDefined(asString(form.address_city), existingClientForm.address_city),
      address_state: pickDefined(asString(form.address_state), existingClientForm.address_state),
      event_date: pickDefined(brToIsoDate(form.event_date), existingClientForm.event_date),
      event_time: pickDefined(normalizeTime(form.event_time), existingClientForm.event_time),
      event_location_name: pickDefined(asString(form.event_location_name), existingClientForm.event_location_name),
      event_location_address: pickDefined(asString(form.event_location_address), existingClientForm.event_location_address),
      signer_name: pickDefined(asString(form.signer_name), existingClientForm.signer_name),
      signer_cpf: pickDefined(cleanDigits(form.signer_cpf), existingClientForm.signer_cpf),
      accepted_terms: form.accepted_terms === true,
      signed_at: assinaturaEm,
    };

    const { error: upContractFilling } = await supabase.from('contracts').update({
      status: 'client_filling',
      signature_name: null,
      signed_at: null,
      contact_id: contactId || contract.contact_id || null,
      event_id: eventId || contract.event_id || null,
      agreed_amount: contract?.agreed_amount ?? precontract?.agreed_amount ?? null,
      base_amount: contract?.base_amount ?? precontract?.base_amount ?? null,
      raw_payload: {
        ...(contract?.raw_payload || {}),
        precontract_snapshot: precontract,
        client_form: clientForm,
      },
    }).eq('id', contract.id);
    if (upContractFilling) throw upContractFilling;

    const genRes = await fetch(new URL('/api/contracts/generate', request.url), {
      method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ precontractId: precontract.id, contractId: contract.id }),
    });
    const genJson = await genRes.json().catch(() => null);
    if (!genRes.ok || !genJson?.ok) {
      console.error('[PUBLIC_CONTRACT_SIGN][GENERATE_FAILED]', {
        status: genRes.status,
        ok: genJson?.ok,
        message: genJson?.message,
        error: genJson?.error,
        errorType: genJson?.errorType,
        precontractId: precontract?.id || null,
        contractId: contract?.id || null,
        eventId: eventId || precontract?.event_id || contract?.event_id || null,
        contactId: contactId || precontract?.contact_id || contract?.contact_id || null,
      });
      return NextResponse.json({ ok: false, message: genJson?.message || genJson?.error || 'Não foi possível gerar o PDF final.', fallbackAllowed: true }, { status: 502 });
    }

    const { data: finalContract, error: cErr } = await supabase.from('contracts').select('*').eq('id', contract.id).single();
    if (cErr) throw cErr;
    const generationMode = asString(genJson?.mode || 'docs').toLowerCase();
    const pdfUrl = asString(finalContract?.pdf_url || genJson?.pdfUrl);
    if (!pdfUrl) {
      if (generationMode === 'internal' && asString(genJson?.html)) {
        return NextResponse.json({ ok: true, mode: 'internal', html: asString(genJson?.html), message: 'Contrato interno gerado sem PDF nesta etapa.', fallbackAllowed: true });
      }
      return NextResponse.json({ ok: false, message: 'Contrato gerado sem PDF final.', fallbackAllowed: true }, { status: 502 });
    }

    const { error: signedContractError } = await supabase.from('contracts').update({
      status: 'signed', signed_at: assinaturaEm, signature_name: asString(form.signer_name) || null,
      contact_id: contactId || finalContract?.contact_id || null,
      event_id: eventId || finalContract?.event_id || null,
      raw_payload: {
        ...(finalContract?.raw_payload || {}),
        final_generation: { mode: generationMode || 'docs', pdfUrl, docUrl: genJson?.docUrl || null, generatedAt: assinaturaEm },
      },
    }).eq('id', contract.id);
    if (signedContractError) throw signedContractError;

    const { error: preSignedErr } = await supabase.from('precontracts').update({ ...payloadPre, status: 'signed' }).eq('id', precontract.id);
    if (preSignedErr) throw preSignedErr;

    await fetch(new URL('/api/whatsapp/send-contract-signed', request.url), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ precontractId: precontract.id }), cache: 'no-store',
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      pdfUrl,
      docUrl: asString(finalContract?.doc_url || genJson?.docUrl),
      html: asString(genJson?.html),
      clientPanelUrl: `/cliente/${token}`,
      missingColumns: Array.isArray(genJson?.missingColumns) ? genJson.missingColumns : [],
      documentHash: asString(genJson?.documentHash),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, message: err?.message || 'Erro ao assinar contrato.', fallbackAllowed: true }, { status: 500 });
  }
}
