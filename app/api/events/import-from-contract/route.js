import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import { saveExternalContractForEvent } from '@/lib/contracts/external-contract-flow';

const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024;
const parseMoney = (v) => Number(String(v || '0').replace(/\./g, '').replace(',', '.')) || 0;
function findField(text, regex) { const m = text.match(regex); return m?.[1]?.trim() || ''; }
function normalizeExtractedText(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF\u2060\u00AD]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
async function extractPdfTextWithContractService(file) {
  const contractServiceUrl = String(process.env.CONTRACT_SERVICE_URL || '').trim();
  const contractServiceApiKey = String(process.env.CONTRACT_SERVICE_API_KEY || '').trim();

  if (!contractServiceUrl || !contractServiceApiKey) {
    throw new Error('Não foi possível processar o PDF automaticamente');
  }

  const endpoint = `${contractServiceUrl.replace(/\/+$/, '')}/api/contracts/extract-pdf-text`;
  const formData = new FormData();
  formData.append('file', file);

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': contractServiceApiKey,
      },
      body: formData,
      cache: 'no-store',
    });
  } catch {
    throw new Error('Não foi possível processar o PDF automaticamente');
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok || !payload?.text) {
    throw new Error(payload?.message || 'Não foi possível extrair texto do PDF');
  }

  return String(payload?.text || '').trim();
}
function toIsoDate(brDate = '') {
  const [dd, mm, yyyy] = brDate.split('/');
  return dd && mm && yyyy ? `${yyyy}-${mm}-${dd}` : '';
}
function pickStatus(extractedFieldCount) {
  if (extractedFieldCount === 0) return 'manual_required';
  if (extractedFieldCount <= 2) return 'partial';
  return 'auto';
}
function buildExtraction(text) {
  const normalizedText = normalizeExtractedText(text);
  const client_name = findField(normalizedText, /contratante:\s*([^\n,]+)/i) || findField(normalizedText, /(?:contratante|cliente)\s*[:\-]\s*([^\n]+)/i);
  const cpf = findField(normalizedText, /CPF.*?(\d{11})/i);
  const location_address = findField(normalizedText, /residente\s+e\s+domiciliad[oa]\s+na\s+(.+?)\s+(?:CONTRATADO|CONTRATANTE)/i) || findField(normalizedText, /endere[cç]o\s*[:\-]\s*([^\n]+)/i);
  const eventDateBr = findField(normalizedText, /dia\s*(\d{2}\/\d{2}\/\d{4})/i) || findField(normalizedText, /(\d{2}\/\d{2}\/\d{4})/i) || findField(normalizedText, /(?:data do evento|data)\s*[:\-]\s*(\d{2}\/\d{2}\/\d{4})/i);
  const event_time = findField(normalizedText, /às?\s*(\d{1,2}:\d{2})/i) || findField(normalizedText, /(?:hor[aá]rio|hora)\s*[:\-]\s*(\d{1,2}:\d{2})/i);
  const location_name = findField(normalizedText, /endere[cç]o:\s*([^\.]+)/i) || findField(normalizedText, /(?:local|espa[cç]o)\s*[:\-]\s*([^\n]+)/i);
  const reception_hours = findField(normalizedText, /(\d+)\s*hrs?\s*de\s*receptivo/i) || (/(?:\breceptiv)/i.test(normalizedText) ? '1' : '');
  const formationMatch = findField(normalizedText, /(quarteto|trio|duo)/i);
  const formation = formationMatch ? formationMatch[0].toUpperCase() + formationMatch.slice(1).toLowerCase() : findField(normalizedText, /forma[cç][aã]o\s*[:\-]\s*([^\n]+)/i);
  const has_sound = /som\s+est[áa]\s+incluso/i.test(normalizedText);
  const agreed_amount = findField(normalizedText, /R\$\s*([\d\.,]+)/i) || findField(normalizedText, /(?:valor contratado|valor)\s*[:\-]\s*R?\$?\s*([\d\.,]+)/i);
  const observations = findField(normalizedText, /(50%\s*at[ée][^\.]+\.)/i);
  const instrumentTokens = [];
  if (/pianista/i.test(normalizedText)) instrumentTokens.push('Piano');
  if (/violinista/i.test(normalizedText)) instrumentTokens.push('violino');
  if (/violonista/i.test(normalizedText)) instrumentTokens.push('violão');
  if (/vocalista|voz/i.test(normalizedText)) instrumentTokens.push('voz');
  const hasTargetInstruments = /pianista.*?violinista.*?violonista.*?(?:um\s+)?vocalista/i.test(normalizedText);
  const instruments = hasTargetInstruments ? 'Piano, violino, violão e voz' : (instrumentTokens.length ? instrumentTokens.join(', ').replace(/, ([^,]+)$/, ' e $1') : findField(normalizedText, /instrumentos?\s*[:\-]\s*([^\n]+)/i));
  const eventTypeMatch = findField(normalizedText, /em um\s+(casamento|anivers[aá]rio|evento)/i) || findField(normalizedText, /(casamento|anivers[aá]rio|evento)/i);
  const event_type = eventTypeMatch ? eventTypeMatch[0].toUpperCase() + eventTypeMatch.slice(1).toLowerCase() : findField(normalizedText, /tipo de evento\s*[:\-]\s*([^\n]+)/i);

  return { client_name, cpf, whatsapp_phone: findField(normalizedText, /(?:whatsapp|telefone|celular)\s*[:\-]\s*([^\n]+)/i), event_type, event_date: toIsoDate(eventDateBr), event_time, duration_min: findField(normalizedText, /dura[cç][aã]o\s*[:\-]\s*(\d{1,3})/i), location_name: location_name.replace(/\.$/, '').replace(/\bsantorini\b/i, 'Santorini'), location_address, formation, instruments, reception_hours, has_sound, agreed_amount, observations, status: 'Confirmado' };
}
function validateMinimum(d) { const m=[]; if(!d.client_name)m.push('client_name'); if(!d.event_type)m.push('event_type'); if(!d.event_date)m.push('event_date'); if(!d.event_time)m.push('event_time'); if(!d.location_name)m.push('location_name'); if(!d.formation)m.push('formation'); if(!d.agreed_amount)m.push('agreed_amount'); return m; }

export async function POST(request) {
  const supabase = getSupabaseAdmin();
  try {
    const auth = await requireAdmin({ supabase, request, logPrefix: '[IMPORT_FROM_CONTRACT_API]' });
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
    const form = await request.formData(); const file = form.get('file'); const mode = String(form.get('mode') || 'extract').trim();
    if (!file || typeof file === 'string') return NextResponse.json({ ok: false, error: 'Arquivo PDF é obrigatório.' }, { status: 400 });
    if (file.type !== 'application/pdf') return NextResponse.json({ ok: false, error: 'Apenas PDF (application/pdf) é aceito.' }, { status: 400 });
    if (file.size > MAX_PDF_SIZE_BYTES) return NextResponse.json({ ok: false, error: 'PDF excede o limite de 15MB.' }, { status: 400 });

    console.log('FILE SIZE:', file.size);
    console.log('FILE TYPE:', file.type);
    const text = await extractPdfTextWithContractService(file);
    console.log('[PDF_TEXT_LENGTH]', text.length);
    console.log('[PDF_SAMPLE]', text.slice(0, 300));
    if (!text.length) {
      return NextResponse.json({ ok: false, message: 'Não foi possível extrair texto do PDF', extractionConfidence: 0 }, { status: 422 });
    }
    if (text.length < 100) {
      return NextResponse.json({
        ok: false,
        message: 'Não foi possível identificar dados automaticamente. Preencha manualmente.',
        extractionConfidence: 0,
      });
    }
    const extractedData = buildExtraction(text);
    const extractedFieldCount = Object.values(extractedData).filter((value) => {
      if (typeof value === 'boolean') return value;
      return Boolean(String(value || '').trim());
    }).length;
    const extractionStatus = pickStatus(extractedFieldCount);
    const missingFields = validateMinimum(extractedData);
    const extractionConfidence = missingFields.length <= 2 ? 0.9 : 0.7;
    console.info('[IMPORT_FROM_CONTRACT_API] extraction', {
      fileName: file.name,
      fileSize: file.size,
      textLength: text.length,
      firstTextSample: text.slice(0, 300),
      extractionMethod: 'contract_service_extract_pdf_text',
      missingFields,
    });
    if (mode === 'extract') {
        const meetsMinimumAuto = ['client_name', 'event_date', 'event_time', 'event_type', 'location_name'].every((field) => Boolean(String(extractedData[field] || '').trim()));
      if (!extractedFieldCount) {
        return NextResponse.json({ ok: true, extractedData: {}, extractionConfidence: 0, missingFields, warning: 'Preenchimento manual necessário', extractionStatus: 'manual_required' });
      }
      return NextResponse.json({ ok: true, extractedData, extractionConfidence, missingFields, extractionStatus: text.length > 300 && meetsMinimumAuto ? extractionStatus : 'manual_required', warning: text.length > 300 && meetsMinimumAuto ? null : 'Preenchimento manual necessário' });
    }

    const reviewedData = JSON.parse(String(form.get('reviewedData') || '{}')); const normalized = { ...extractedData, ...reviewedData }; const missing = validateMinimum(normalized);
    if (missing.length) return NextResponse.json({ ok: false, error: 'Campos mínimos obrigatórios não confirmados.', missingFields: missing }, { status: 400 });
    const agreedAmount = parseMoney(normalized.agreed_amount);
    const { data: event, error: eventError } = await supabase.from('events').insert({ client_name: String(normalized.client_name || '').trim(), event_type: normalized.event_type || null, event_date: normalized.event_date || null, event_time: normalized.event_time || null, duration_min: Number(normalized.duration_min || 60), location_name: normalized.location_name || normalized.location_address || null, location_address: normalized.location_address || null, formation: normalized.formation || null, instruments: normalized.instruments || null, reception_hours: Number(normalized.reception_hours || 0), has_sound: Boolean(normalized.has_sound), agreed_amount: agreedAmount, payment_status: 'Pendente', status: normalized.status || 'Confirmado', whatsapp_name: normalized.client_name || null, whatsapp_phone: normalized.whatsapp_phone || null, observations: normalized.observations || null, open_amount: agreedAmount, paid_amount: 0, costs_source: 'default' }).select('id, client_contact_id').single();
    if (eventError) throw eventError;

    const result = await saveExternalContractForEvent({ supabase, eventId: event.id, file, contactId: event.client_contact_id, rawPayload: { external_contract: true, external_contract_source: 'admin_upload_from_event_creation', extracted_contract_data: extractedData, extraction_confidence: extractionConfidence, admin_reviewed_at: new Date().toISOString() } });
    return NextResponse.json({ ok: true, eventId: event.id, contractId: result.contract.id, pdfUrl: result.pdfUrl, clientPanelLink: result.clientPanelLink });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || 'Falha no fluxo de importação.' }, { status: error?.status || 500 });
  }
}
