import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import { saveExternalContractForEvent } from '@/lib/contracts/external-contract-flow';

const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024;
const parseMoney = (v) => Number(String(v || '0').replace(/\./g, '').replace(',', '.')) || 0;
function findField(text, regex) { const m = text.match(regex); return m?.[1]?.trim() || ''; }
function extractPdfText(buffer) { const raw = Buffer.from(buffer).toString('latin1'); return [...raw.matchAll(/\(([^()]{2,400})\)\s*Tj/g)].map((m) => m[1]).join('\n').replace(/\\n/g, ' ').trim(); }
function buildExtraction(text) { return { client_name: findField(text, /(?:contratante|cliente)\s*[:\-]\s*([^\n]+)/i), guests_emails: findField(text, /(?:e-?mail)\s*[:\-]\s*([^\s\n]+@[^\s\n]+)/i), whatsapp_phone: findField(text, /(?:whatsapp|telefone|celular)\s*[:\-]\s*([^\n]+)/i), event_date: (() => { const d = findField(text, /(?:data do evento|data)\s*[:\-]\s*(\d{2}\/\d{2}\/\d{4})/i); return d ? d.split('/').reverse().join('-') : ''; })(), event_time: findField(text, /(?:hor[aá]rio|hora)\s*[:\-]\s*(\d{1,2}:\d{2})/i), event_type: findField(text, /tipo de evento\s*[:\-]\s*([^\n]+)/i), duration_min: findField(text, /dura[cç][aã]o\s*[:\-]\s*(\d{1,3})/i), location_name: findField(text, /(?:local|espa[cç]o)\s*[:\-]\s*([^\n]+)/i), location_address: findField(text, /endere[cç]o\s*[:\-]\s*([^\n]+)/i), formation: findField(text, /forma[cç][aã]o\s*[:\-]\s*([^\n]+)/i), instruments: findField(text, /instrumentos?\s*[:\-]\s*([^\n]+)/i), agreed_amount: findField(text, /(?:valor contratado|valor)\s*[:\-]\s*R?\$?\s*([\d\.,]+)/i), observations: '', status: 'Confirmado' }; }
function validateMinimum(d) { const m=[]; if(!d.client_name)m.push('client_name'); if(!d.event_date)m.push('event_date'); if(!d.event_time)m.push('event_time'); if(!d.event_type)m.push('event_type'); if(!d.location_name&&!d.location_address)m.push('location_name/location_address'); if(!d.formation&&!d.instruments)m.push('formation/instruments'); return m; }

export async function POST(request) {
  const supabase = getSupabaseAdmin();
  try {
    const auth = await requireAdmin({ supabase, request, logPrefix: '[IMPORT_FROM_CONTRACT_API]' });
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
    const form = await request.formData(); const file = form.get('file'); const mode = String(form.get('mode') || 'extract').trim();
    if (!file || typeof file === 'string') return NextResponse.json({ ok: false, error: 'Arquivo PDF é obrigatório.' }, { status: 400 });
    if (file.type !== 'application/pdf') return NextResponse.json({ ok: false, error: 'Apenas PDF (application/pdf) é aceito.' }, { status: 400 });
    if (file.size > MAX_PDF_SIZE_BYTES) return NextResponse.json({ ok: false, error: 'PDF excede o limite de 15MB.' }, { status: 400 });

    const bytes = await file.arrayBuffer(); const text = extractPdfText(bytes); const extractedData = buildExtraction(text); const missingFields = validateMinimum(extractedData); const extractionConfidence = text ? (missingFields.length ? 'medium' : 'high') : 'low';
    if (mode === 'extract') {
      if (!text) return NextResponse.json({ ok: true, extractedData: {}, extractionConfidence: 'low', missingFields: ['text_unreadable'], message: 'Não foi possível ler automaticamente. Preencha manualmente.' });
      return NextResponse.json({ ok: true, extractedData, extractionConfidence, missingFields });
    }

    const reviewedData = JSON.parse(String(form.get('reviewedData') || '{}')); const normalized = { ...extractedData, ...reviewedData }; const missing = validateMinimum(normalized);
    if (missing.length) return NextResponse.json({ ok: false, error: 'Campos mínimos obrigatórios não confirmados.', missingFields: missing }, { status: 400 });
    const agreedAmount = parseMoney(normalized.agreed_amount);
    const { data: event, error: eventError } = await supabase.from('events').insert({ client_name: String(normalized.client_name || '').trim(), event_type: normalized.event_type || null, event_date: normalized.event_date || null, event_time: normalized.event_time || null, duration_min: Number(normalized.duration_min || 60), location_name: normalized.location_name || normalized.location_address || null, location_address: normalized.location_address || null, formation: normalized.formation || null, instruments: normalized.instruments || null, agreed_amount: agreedAmount, payment_status: 'Pendente', status: normalized.status || 'Confirmado', whatsapp_name: normalized.client_name || null, whatsapp_phone: normalized.whatsapp_phone || null, guests_emails: normalized.guests_emails || null, observations: normalized.observations || null, open_amount: agreedAmount, paid_amount: 0, costs_source: 'default' }).select('id, client_contact_id').single();
    if (eventError) throw eventError;

    const result = await saveExternalContractForEvent({ supabase, eventId: event.id, file, contactId: event.client_contact_id, rawPayload: { external_contract: true, external_contract_source: 'admin_upload_from_event_creation', extracted_contract_data: extractedData, extraction_confidence: extractionConfidence, admin_reviewed_at: new Date().toISOString() } });
    return NextResponse.json({ ok: true, eventId: event.id, contractId: result.contract.id, pdfUrl: result.pdfUrl, clientPanelLink: result.clientPanelLink });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || 'Falha no fluxo de importação.' }, { status: error?.status || 500 });
  }
}
