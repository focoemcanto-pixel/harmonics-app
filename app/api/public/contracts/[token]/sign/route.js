import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateRequiredEnv } from '@/lib/config/validate-env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const asString = (v) => String(v || '').trim();
const cleanDigits = (v) => asString(v).replace(/\D/g, '');
const normalizeTime = (value) => {
  const raw = asString(value);
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2})(?::?(\d{2}))?$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2] || 0);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};
const brToIsoDate = (value) => {
  const raw = asString(value);
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return raw || null;
  return `${m[3]}-${m[2]}-${m[1]}`;
};

function extractToken(params) {
  if (Array.isArray(params?.token)) return asString(params.token[0]);
  return asString(params?.token);
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
      const inserted = await supabase.from('contracts').insert({ precontract_id: precontract.id, public_token: token, status: 'client_filling' }).select('*').single();
      if (inserted.error) throw inserted.error;
      contract = inserted.data;
    }

    const payloadPre = {
      client_name: asString(form.full_name) || precontract.client_name || null,
      client_phone: cleanDigits(form.whatsapp) || precontract.client_phone || null,
      event_date: brToIsoDate(form.event_date) || precontract.event_date || null,
      event_time: normalizeTime(form.event_time) || normalizeTime(precontract.event_time) || null,
      location_name: asString(form.event_location_name) || precontract.location_name || null,
      location_address: asString(form.event_location_address) || precontract.location_address || null,
      status: 'client_filling',
    };
    const { error: upPre } = await supabase.from('precontracts').update(payloadPre).eq('id', precontract.id);
    if (upPre) throw upPre;

    const genRes = await fetch(new URL('/api/contracts/generate', request.url), {
      method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ precontractId: precontract.id, contractId: contract.id }),
    });
    const genJson = await genRes.json().catch(() => null);
    if (!genRes.ok || !genJson?.ok) {
      return NextResponse.json({ ok: false, message: genJson?.message || 'Não foi possível gerar o PDF final.', fallbackAllowed: true }, { status: 502 });
    }

    const { data: finalContract, error: cErr } = await supabase.from('contracts').select('*').eq('id', contract.id).single();
    if (cErr) throw cErr;
    const pdfUrl = asString(finalContract?.pdf_url || genJson?.pdfUrl);
    if (!pdfUrl) return NextResponse.json({ ok: false, message: 'Contrato gerado sem PDF final.', fallbackAllowed: true }, { status: 502 });

    const now = new Date().toISOString();
    const { error: signedContractError } = await supabase.from('contracts').update({
      status: 'signed', signed_at: now, signature_name: asString(form.signer_name) || null,
      raw_payload: { ...(finalContract?.raw_payload || {}), final_generation: { mode: genJson?.mode || 'docs', pdfUrl, docUrl: genJson?.docUrl || null, generatedAt: now } },
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
