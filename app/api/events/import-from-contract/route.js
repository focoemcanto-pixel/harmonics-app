import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import { saveExternalContractForEvent } from '@/lib/contracts/external-contract-flow';

const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024;
const parseMoney = (v) => Number(String(v || '0').replace(/\./g, '').replace(',', '.')) || 0;
function findField(text, regex) { const m = text.match(regex); return m?.[1]?.trim() || ''; }
function decodePdfToken(token = '') {
  if (token.startsWith('(') && token.endsWith(')')) {
    return token
      .slice(1, -1)
      .replace(/\\n/g, ' ')
      .replace(/\\r/g, ' ')
      .replace(/\\t/g, ' ')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');
  }
  if (token.startsWith('<') && token.endsWith('>')) {
    const hex = token.slice(1, -1).replace(/[^\da-f]/gi, '');
    if (!hex) return '';
    return Buffer.from(hex, 'hex').toString('latin1');
  }
  return '';
}
function extractPdfText(buffer) {
  const raw = Buffer.from(buffer).toString('latin1');
  const chunks = [];
  const simpleText = [...raw.matchAll(/(\((?:\\.|[^\\()])*\)|<[\da-fA-F\s]+>)\s*Tj/g)].map((m) => decodePdfToken(m[1]));
  chunks.push(...simpleText);
  for (const m of raw.matchAll(/\[(.*?)\]\s*TJ/gs)) {
    const parts = [...m[1].matchAll(/(\((?:\\.|[^\\()])*\)|<[\da-fA-F\s]+>)/g)].map((item) => decodePdfToken(item[1])).filter(Boolean);
    if (parts.length) chunks.push(parts.join(' '));
  }
  return chunks.join('\n').replace(/\s+/g, ' ').trim();
}
function toIsoDate(brDate = '') {
  const [dd, mm, yyyy] = brDate.split('/');
  return dd && mm && yyyy ? `${yyyy}-${mm}-${dd}` : '';
}
function buildExtraction(text) {
  const normalizedText = text.replace(/\s+/g, ' ');
  const client_name = findField(normalizedText, /CONTRATANTE:\s*([^,\n]+)/i) || findField(normalizedText, /(?:contratante|cliente)\s*[:\-]\s*([^\n]+)/i);
  const cpf = findField(normalizedText, /CPF\s*(?:sob\s*o\s*n[ºo]\s*|n[ºo]\s*)?(\d{11})/i);
  const location_address = findField(normalizedText, /residente\s+e\s+domiciliad[oa]\s+na\s+(.+?)\s+(?:CONTRATADO|CONTRATANTE)/i) || findField(normalizedText, /endere[cç]o\s*[:\-]\s*([^\n]+)/i);
  const eventDateBr = findField(normalizedText, /ser[áa]\s+realizado\s+no\s+dia\s+(\d{2}\/\d{2}\/\d{4})/i) || findField(normalizedText, /(?:data do evento|data)\s*[:\-]\s*(\d{2}\/\d{2}\/\d{4})/i);
  const event_time = findField(normalizedText, /[àa]s\s*(\d{1,2}:\d{2})/i) || findField(normalizedText, /(?:hor[aá]rio|hora)\s*[:\-]\s*(\d{1,2}:\d{2})/i);
  const location_name = findField(normalizedText, /no\s+endere[cç]o\s*:\s*([^\.\n]+)/i) || findField(normalizedText, /(?:local|espa[cç]o)\s*[:\-]\s*([^\n]+)/i);
  const reception_hours = findField(normalizedText, /mais\s*(\d{1,2})\s*h(?:rs?|oras?)\s*de\s*receptiv/i) || (/(?:\breceptiv)/i.test(normalizedText) ? '1' : '');
  const formation = /quarteto/i.test(normalizedText) ? 'Quarteto' : findField(normalizedText, /forma[cç][aã]o\s*[:\-]\s*([^\n]+)/i);
  const has_sound = /som\s+est[áa]\s+incluso/i.test(normalizedText);
  const agreed_amount = findField(normalizedText, /R\$\s*([\d\.]+(?:,\d{2})?)/i) || findField(normalizedText, /(?:valor contratado|valor)\s*[:\-]\s*R?\$?\s*([\d\.,]+)/i);
  const observations = findField(normalizedText, /(50%\s*at[ée][^\.]+\.)/i);
  const instrumentTokens = [];
  if (/pianista/i.test(normalizedText)) instrumentTokens.push('Piano');
  if (/violinista/i.test(normalizedText)) instrumentTokens.push('violino');
  if (/violonista/i.test(normalizedText)) instrumentTokens.push('violão');
  if (/vocalista|voz/i.test(normalizedText)) instrumentTokens.push('voz');
  const instruments = instrumentTokens.length ? instrumentTokens.join(', ').replace(/, ([^,]+)$/, ' e $1') : findField(normalizedText, /instrumentos?\s*[:\-]\s*([^\n]+)/i);
  const event_type = /casamento/i.test(normalizedText) ? 'Casamento' : findField(normalizedText, /tipo de evento\s*[:\-]\s*([^\n]+)/i);

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

    const bytes = await file.arrayBuffer(); const text = extractPdfText(bytes); const extractedData = buildExtraction(text); const missingFields = validateMinimum(extractedData); const extractionConfidence = !text ? 'low' : (missingFields.length <= 2 ? 'medium' : 'high');
    if (mode === 'extract') {
      if (!text) return NextResponse.json({ ok: true, extractedData: {}, extractionConfidence: 'low', missingFields: ['text_unreadable'], message: 'Não foi possível ler automaticamente. Preencha manualmente.' });
      return NextResponse.json({ ok: true, extractedData, extractionConfidence, missingFields });
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
