import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { normalizeTimeStrict } from '@/lib/time/normalize-time';
import { getCurrentWorkspace } from '@/lib/workspaces/get-current-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_FIELDS = [
  'full_name', 'marital_status', 'profession', 'cpf', 'rg', 'whatsapp',
  'address_street', 'address_number', 'address_complement',
  'address_neighborhood', 'address_cep', 'address_city', 'address_state',
  'event_date', 'event_time', 'event_location_name', 'event_location_address',
  'signer_name', 'signer_cpf', 'accepted_terms',
];

function asString(value) { return String(value || '').trim(); }
function digits(value) { return asString(value).replace(/\D/g, ''); }
function extractToken(params) {
  if (Array.isArray(params?.token)) return asString(params.token[0]);
  return asString(params?.token);
}
function isoToBrDate(value) {
  const raw = asString(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw;
  return `${match[3]}/${match[2]}/${match[1]}`;
}
function normalizeDraftInput(raw = {}) {
  const normalized = {};
  for (const field of ALLOWED_FIELDS) {
    if (!(field in raw)) continue;
    if (field === 'accepted_terms') {
      normalized[field] = raw[field] === true;
      continue;
    }
    const value = asString(raw[field]);
    if (field === 'cpf' || field === 'signer_cpf') normalized[field] = digits(value);
    else if (field === 'whatsapp') normalized[field] = digits(value);
    else if (field === 'address_cep') normalized[field] = digits(value);
    else if (field === 'event_time') normalized[field] = normalizeTimeStrict(value) || value;
    else normalized[field] = value;
  }
  return normalized;
}

function buildInitialForm({ precontract, contact, event, clientForm }) {
  const pre = precontract || {};
  const con = contact || {};
  const evt = event || {};
  const saved = clientForm || {};

  return {
    full_name: saved.full_name || con.name || pre.client_name || '',
    marital_status: saved.marital_status || '',
    profession: saved.profession || '',
    cpf: saved.cpf || con.cpf_cnpj || '',
    rg: saved.rg || '',
    whatsapp: saved.whatsapp || con.phone || pre.client_phone || '',
    address_street: saved.address_street || '',
    address_number: saved.address_number || '',
    address_complement: saved.address_complement || '',
    address_neighborhood: saved.address_neighborhood || '',
    address_cep: saved.address_cep || '',
    address_city: saved.address_city || '',
    address_state: saved.address_state || '',
    event_date: saved.event_date || isoToBrDate(evt.event_date || pre.event_date || ''),
    event_time: saved.event_time || normalizeTimeStrict(evt.event_time || pre.event_time || ''),
    event_location_name: saved.event_location_name || evt.location_name || pre.location_name || '',
    event_location_address: saved.event_location_address || evt.location_address || pre.location_address || '',
    signer_name: saved.signer_name || '',
    signer_cpf: saved.signer_cpf || '',
    accepted_terms: saved.accepted_terms === true,
  };
}

async function loadContext(token, supabase) {
  const { data: precontract, error: preError } = await supabase.from('precontracts').select('*').eq('public_token', token).maybeSingle();
  if (preError) throw preError;
  if (!precontract?.id) return { precontract: null, contract: null, contact: null, event: null };

  const { data: contract, error: cError } = await supabase.from('contracts').select('*').eq('precontract_id', precontract.id).maybeSingle();
  if (cError) throw cError;

  const contactId = contract?.contact_id || precontract?.contact_id || null;
  const eventId = contract?.event_id || precontract?.event_id || null;

  const [{ data: contact }, { data: event }] = await Promise.all([
    contactId ? supabase.from('contacts').select('*').eq('id', contactId).maybeSingle() : Promise.resolve({ data: null }),
    eventId ? supabase.from('events').select('*').eq('id', eventId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  return { precontract, contract: contract || null, contact: contact || null, event: event || null };
}

async function logWorkspaceContext(supabase, routeName) {
  const workspaceContext = await getCurrentWorkspace({ supabase });
  console.info('[WORKSPACE_CONTEXT]', {
    route: routeName,
    workspaceId: workspaceContext.workspaceId,
    source: workspaceContext.source,
  });
  return workspaceContext;
}

export async function GET(_request, context) {
  const params = await context?.params;
  const token = extractToken(params);
  if (!token) return NextResponse.json({ ok: false, message: 'Token inválido.' }, { status: 400 });
  try {
    const supabase = getSupabaseAdmin();
    await logWorkspaceContext(supabase, 'public_contract_draft_get');
    const { precontract, contract, contact, event } = await loadContext(token, supabase);
    if (!precontract?.id) return NextResponse.json({ ok: false, message: 'Contrato não encontrado.' }, { status: 404 });
    const clientForm = contract?.raw_payload?.client_form || {};
    return NextResponse.json({ ok: true, initial_form: buildInitialForm({ precontract, contact, event, clientForm }), contract_status: contract?.status || null });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error?.message || 'Erro ao carregar draft.' }, { status: 500 });
  }
}

export async function PATCH(request, context) {
  const params = await context?.params;
  const token = extractToken(params);
  if (!token) return NextResponse.json({ ok: false, message: 'Token inválido.' }, { status: 400 });
  try {
    const body = await request.json().catch(() => ({}));
    const input = normalizeDraftInput(body?.form || body || {});
    const supabase = getSupabaseAdmin();
    const workspaceContext = await logWorkspaceContext(supabase, 'public_contract_draft_patch');
    const { precontract, contract } = await loadContext(token, supabase);
    if (!precontract?.id) return NextResponse.json({ ok: false, message: 'Contrato não encontrado.' }, { status: 404 });
    if (contract?.status === 'signed') return NextResponse.json({ ok: true, skipped: true });

    let current = contract;
    if (!current?.id) {
      const inserted = await supabase
        .from('contracts')
        .insert({
          precontract_id: precontract.id,
          public_token: precontract.public_token || token,
          status: 'client_filling',
          workspace_id: precontract.workspace_id || workspaceContext.workspaceId,
        })
        .select('*')
        .single();
      if (inserted.error) throw inserted.error;
      current = inserted.data;
    }

    const mergedClientForm = { ...(current?.raw_payload?.client_form || {}), ...input };
    const rawPayload = {
      ...(current?.raw_payload || {}),
      client_form: mergedClientForm,
      client_form_saved_at: new Date().toISOString(),
      client_form_saved_from: 'public_contract_page',
    };

    const { error } = await supabase.from('contracts').update({ raw_payload: rawPayload }).eq('id', current.id);
    if (error) throw error;

    return NextResponse.json({ ok: true, saved_at: rawPayload.client_form_saved_at });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error?.message || 'Erro ao salvar draft.' }, { status: 500 });
  }
}
