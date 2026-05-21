import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';
import { saveExternalContractForEvent } from '@/lib/contracts/external-contract-flow';
import { sendAdminWhatsAppAlert } from '@/lib/whatsapp/send-admin-alert';
import { extractContractDataWithAi } from '@/lib/contracts/ai-contract-extractor';
import { createDefaultPaymentScheduleForEvent } from '@/lib/finance/create-payment-schedule';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024;
const DEFAULT_STATUS = 'Confirmado';

const parseMoney = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  return Number(String(value || '0').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
};

const asString = (value) => String(value || '').trim();

function normalizeExtractedText(text = '') {
  return String(text || '')
    .replace(/[\u200B-\u200D\uFEFF\u2060\u00AD]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeLower(text = '') {
  return normalizeExtractedText(text).toLowerCase();
}

function findField(text, regex) {
  const match = String(text || '').match(regex);
  return asString(match?.[1]);
}

function toIsoDate(value = '') {
  const raw = asString(value);
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? raw : '';
}

function normalizeInstruments(value = '') {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/\bpianista\b/g, 'piano')
    .replace(/\btecladista\b/g, 'teclado')
    .replace(/\bviolinista\b/g, 'violino')
    .replace(/\bviolonista\b/g, 'violão')
    .replace(/\bvocalista\b/g, 'voz')
    .replace(/\bcantor(?:a)?\b/g, 'voz');

  const items = normalized
    .split(/\s*,\s*|\s+e\s+/i)
    .map((item) => item.trim())
    .filter(Boolean);
  const unique = Array.from(new Set(items));
  if (unique.length === 0) return '';
  const pretty = unique.map((item) => item.charAt(0).toUpperCase() + item.slice(1));
  if (pretty.length === 1) return pretty[0];
  return `${pretty.slice(0, -1).join(', ')} e ${pretty[pretty.length - 1]}`;
}

function inferFormationFromInstruments(value = '') {
  const count = String(value || '')
    .split(/\s*,\s*|\s+e\s+/i)
    .map((item) => item.trim())
    .filter(Boolean).length;
  if (count === 1) return 'Solo';
  if (count === 2) return 'Duo';
  if (count === 3) return 'Trio';
  if (count === 4) return 'Quarteto';
  if (count === 5) return 'Quinteto';
  return '';
}

function extractObjectBlock(rawText = '') {
  const text = String(rawText || '');
  const patterns = [
    /DO\s+OBJETO\s+DO\s+CONTRATO([\s\S]*?)(?:Dura[cç][aã]o|DOS\s+EQUIPAMENTOS|DO\s+VALOR|VALOR|$)/i,
    /OBJETO([\s\S]*?)(?:Dura[cç][aã]o|DOS\s+EQUIPAMENTOS|DO\s+VALOR|VALOR|$)/i,
    /Cl[aá]usula\s*1[ªa]?([\s\S]*?)(?:Cl[aá]usula\s*2|DOS\s+EQUIPAMENTOS|DO\s+VALOR|$)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return text.slice(0, 5000);
}

function splitAddressAndVenue(rawAddress = '') {
  const value = asString(rawAddress).replace(/[.;]+$/, '');
  if (!value) return { location_name: '', location_address: '' };
  const parts = value.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      location_address: parts.slice(0, -1).join(' - '),
      location_name: parts[parts.length - 1],
    };
  }
  return { location_name: '', location_address: value };
}

function regexExtract(text = '') {
  const rawText = String(text || '');
  const objectBlock = extractObjectBlock(rawText);
  const lowerAll = normalizeLower(rawText);
  const lowerObject = normalizeLower(objectBlock);
  const textBeforeContractor = rawText.split(/CONTRATADO:/i)[0] || rawText;

  const dateTime = objectBlock.match(/(?:dia\s*)?(\d{2}\/\d{2}\/\d{4})[^\d]{1,40}(?:às|as|hor[aá]rio|hora)?\s*(\d{1,2}:\d{2})/i);
  const addressRaw = findField(objectBlock, /endere[cç]o\s*:?\s*([\s\S]*?)(?:\.\s|mais\s+\d+\s*hrs?|dura[cç][aã]o|som|valor|$)/i);
  const address = splitAddressAndVenue(addressRaw);
  const instrumentsRaw =
    findField(objectBlock, /instrumentistas?\s*\((.*?)\)/i) ||
    findField(objectBlock, /instrumentos?\s*[:\-]\s*([^.;\n]+)/i) ||
    findField(objectBlock, /forma[cç][aã]o\s*[:\-]\s*([^.;\n]+)/i);
  const instruments = normalizeInstruments(instrumentsRaw);
  const formationRaw = findField(lowerObject, /(solo|duo|trio|quarteto|quinteto|sexteto)/i);
  const formation = formationRaw ? formationRaw.charAt(0).toUpperCase() + formationRaw.slice(1) : inferFormationFromInstruments(instruments);

  const eventTypeRaw =
    findField(objectBlock, /(?:evento|cerim[oô]nia|contrata[cç][aã]o)\s+de\s+([a-zà-úç ]{3,40})/i) ||
    findField(objectBlock, /em\s+um\s+([a-zà-úç ]{3,40})\s+que\s+ser[aá]/i);

  return {
    client_name:
      findField(textBeforeContractor, /CONTRATANTE:\s*([^,\n]+)/i) ||
      findField(textBeforeContractor, /(?:cliente|contratante)\s*[:\-]\s*([^,\n]+)/i),
    whatsapp_phone: findField(rawText, /(?:whatsapp|telefone|celular)\s*[:\-]?\s*([+\d()\s.-]{8,})/i),
    event_type: asString(eventTypeRaw).split(/\s+que\s+/i)[0],
    event_date: toIsoDate(dateTime?.[1] || findField(objectBlock, /(\d{2}\/\d{2}\/\d{4})/i)),
    event_time: asString(dateTime?.[2] || findField(objectBlock, /(\d{1,2}:\d{2})/i)),
    duration_min: findField(lowerAll, /dura[cç][aã]o\s*[:\-]?\s*(\d{1,3})/i),
    location_name: address.location_name || findField(objectBlock, /(?:local|espa[cç]o)\s*[:\-]\s*([^.;\n]+)/i),
    location_address: address.location_address,
    formation,
    instruments,
    reception_hours: findField(lowerObject, /(\d+)\s*hrs?\s*de\s*receptivo/i) || (/receptiv/i.test(lowerObject) ? '1' : ''),
    has_sound: /som\s+(?:est[aá]\s+)?(?:incluso|inclu[ií]do)/i.test(lowerObject),
    agreed_amount: findField(rawText, /R\$\s*([\d.]+,\d{2})/i),
    observations: findField(rawText, /(50%\s*at[ée][^.]+\.)/i),
    status: DEFAULT_STATUS,
  };
}

function mergeData(primary = {}, fallback = {}) {
  const merged = { ...fallback, ...primary };
  Object.keys(fallback || {}).forEach((key) => {
    if (merged[key] === undefined || merged[key] === null || String(merged[key]).trim() === '') {
      merged[key] = fallback[key];
    }
  });
  if (merged.event_date) merged.event_date = toIsoDate(merged.event_date);
  if (merged.instruments) merged.instruments = normalizeInstruments(merged.instruments);
  if (!merged.formation && merged.instruments) merged.formation = inferFormationFromInstruments(merged.instruments);
  if (!merged.status) merged.status = DEFAULT_STATUS;
  return merged;
}

function validateMinimum(data = {}) {
  const missing = [];
  if (!asString(data.client_name)) missing.push('client_name');
  if (!asString(data.event_type)) missing.push('event_type');
  if (!asString(data.event_date)) missing.push('event_date');
  if (!asString(data.event_time)) missing.push('event_time');
  if (!asString(data.location_name) && !asString(data.location_address)) missing.push('location_name_or_address');
  const hasAmount = asString(data.agreed_amount);
  const hasFormationAndInstruments = asString(data.formation) && asString(data.instruments);
  if (!hasAmount && !hasFormationAndInstruments) missing.push('agreed_amount_or_formation_instruments');
  return missing;
}

function getEssentialMissingFields(data = {}) {
  return ['client_name', 'event_type', 'event_date', 'event_time', 'location_name', 'location_address', 'formation', 'instruments', 'agreed_amount']
    .filter((field) => !asString(data[field]));
}

async function extractPdfTextWithContractService(file) {
  const contractServiceUrl = String(
    process.env.CONTRACT_SERVICE_URL ||
    process.env.NEXT_PUBLIC_CONTRACT_SERVICE_URL ||
    process.env.CONTRACT_SERVICE_BASE_URL ||
    ''
  ).trim();
  const contractServiceApiKey = String(process.env.CONTRACT_SERVICE_API_KEY || '').trim();

  if (!contractServiceUrl) {
    const error = new Error('Serviço de leitura de PDF não configurado. Preencha manualmente ou configure CONTRACT_SERVICE_URL.');
    error.status = 200;
    throw error;
  }

  const endpoint = `${contractServiceUrl.replace(/\/+$/, '')}/api/contracts/extract-pdf-text`;
  const formData = new FormData();
  formData.append('file', file);

  const headers = contractServiceApiKey ? { 'x-api-key': contractServiceApiKey } : undefined;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: formData,
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok || !payload?.text) {
    const error = new Error(payload?.message || payload?.error || 'Não foi possível ler o texto do PDF.');
    error.status = response.status || 502;
    throw error;
  }

  return asString(payload.text);
}

async function extractDataFromPdf(file) {
  let text = '';
  try {
    text = await extractPdfTextWithContractService(file);
  } catch (error) {
    return {
      ok: true,
      extractedData: {},
      missingFields: validateMinimum({}),
      extractionConfidence: 0,
      extractionStatus: 'manual_required',
      warning: error?.message || 'Não foi possível extrair automaticamente. Preencha manualmente.',
      extractionMethod: 'manual_fallback',
    };
  }

  if (!text || text.length < 80) {
    return {
      ok: true,
      extractedData: {},
      missingFields: validateMinimum({}),
      extractionConfidence: 0,
      extractionStatus: 'manual_required',
      warning: 'Não foi possível identificar texto suficiente no PDF. Preencha manualmente.',
      extractionMethod: 'manual_fallback',
    };
  }

  const regexData = regexExtract(text);
  const essentialMissing = getEssentialMissingFields(regexData);
  let aiUsed = false;
  let aiModel = null;
  let aiData = {};

  try {
    const aiResult = await extractContractDataWithAi({ text, missingFields: essentialMissing });
    aiUsed = aiResult?.aiUsed === true;
    aiModel = aiResult?.model || null;
    aiData = aiResult?.aiData || {};
  } catch (error) {
    console.warn('[IMPORT_FROM_CONTRACT_API][AI_FALLBACK_ERROR]', { message: error?.message });
  }

  const finalData = mergeData(aiData, regexData);
  const missingFields = validateMinimum(finalData);
  const filledCount = Object.values(finalData).filter((value) => typeof value === 'boolean' ? value : asString(value)).length;
  const extractionConfidence = missingFields.length === 0 ? 95 : missingFields.length <= 2 ? 82 : 60;

  return {
    ok: true,
    extractedData: finalData,
    missingFields,
    extractionConfidence,
    confidence: extractionConfidence,
    extractionStatus: filledCount === 0 ? 'manual_required' : missingFields.length <= 2 ? 'auto' : 'partial',
    extractionMethod: aiUsed ? 'ai_assisted' : 'regex',
    aiUsed,
    aiModel,
    warning: missingFields.length ? 'Revise e complete os campos antes de criar o evento.' : null,
  };
}

function parseReviewedData(form) {
  try {
    return JSON.parse(String(form.get('reviewedData') || '{}')) || {};
  } catch {
    return {};
  }
}

function buildEventPayload({ normalized, agreedAmount, workspaceId }) {
  return {
    workspace_id: workspaceId,
    client_name: asString(normalized.client_name),
    event_type: asString(normalized.event_type) || null,
    event_date: toIsoDate(normalized.event_date) || null,
    event_time: asString(normalized.event_time) || null,
    duration_min: Number(normalized.duration_min || 60),
    location_name: asString(normalized.location_name || normalized.location_address) || null,
    location_address: asString(normalized.location_address) || null,
    formation: asString(normalized.formation) || null,
    instruments: asString(normalized.instruments) || null,
    reception_hours: Number(normalized.reception_hours || 0),
    has_sound: normalized.has_sound === true || String(normalized.has_sound) === 'true',
    agreed_amount: agreedAmount,
    payment_status: 'Pendente',
    status: asString(normalized.status) || DEFAULT_STATUS,
    whatsapp_name: asString(normalized.client_name) || null,
    whatsapp_phone: asString(normalized.whatsapp_phone) || null,
    observations: asString(normalized.observations) || null,
    open_amount: agreedAmount,
    paid_amount: 0,
    costs_source: 'default',
  };
}

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAdmin({
      supabase,
      request,
      logPrefix: '[IMPORT_FROM_CONTRACT_API]',
    });
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
    }

    const form = await request.formData();
    const file = form.get('file');
    const mode = asString(form.get('mode') || 'extract');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ ok: false, error: 'Arquivo PDF é obrigatório.' }, { status: 400 });
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ ok: false, error: 'Apenas PDF (application/pdf) é aceito.' }, { status: 400 });
    }
    if (file.size > MAX_PDF_SIZE_BYTES) {
      return NextResponse.json({ ok: false, error: 'PDF excede o limite de 15MB.' }, { status: 400 });
    }

    if (mode === 'extract') {
      const result = await extractDataFromPdf(file);
      return NextResponse.json(result);
    }

    const reviewedData = parseReviewedData(form);
    const normalized = mergeData(reviewedData, {});
    const missing = validateMinimum(normalized);
    if (missing.length) {
      return NextResponse.json(
        { ok: false, error: 'Campos mínimos obrigatórios não confirmados.', missingFields: missing },
        { status: 400 }
      );
    }

    const agreedAmount = parseMoney(normalized.agreed_amount);
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert(buildEventPayload({ normalized, agreedAmount, workspaceId: auth.workspaceId }))
      .select('id, client_contact_id, event_date')
      .single();

    if (eventError) throw eventError;

    const paymentScheduleResult = await createDefaultPaymentScheduleForEvent({
      supabase,
      eventId: event.id,
      agreedAmount,
      eventDate: event.event_date || normalized.event_date || null,
    });

    const result = await saveExternalContractForEvent({
      supabase,
      workspaceId: auth.workspaceId,
      eventId: event.id,
      file,
      contactId: event.client_contact_id,
      rawPayload: {
        external_contract: true,
        external_contract_signed_outside_app: true,
        external_contract_source: 'admin_upload_from_event_creation',
        extracted_contract_data: normalized,
        final_extracted_contract_data: normalized,
        admin_reviewed_at: new Date().toISOString(),
        payment_schedule_created_at: paymentScheduleResult?.created > 0 ? new Date().toISOString() : null,
      },
    });

    return NextResponse.json({
      ok: true,
      eventId: event.id,
      contractId: result.contract.id,
      pdfUrl: result.pdfUrl,
      contractPdfUrl: result.pdfUrl,
      clientPanelLink: result.clientPanelLink,
      externalContract: true,
      signedOutsideApp: true,
    });
  } catch (error) {
    console.error('[IMPORT_FROM_CONTRACT_API][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      status: error?.status,
    });
    await sendAdminWhatsAppAlert(`🚨 Erro crítico em import-from-contract: ${error?.message || 'erro desconhecido'}`).catch(() => null);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Falha no fluxo de importação.' },
      { status: error?.status && error.status >= 400 ? error.status : 500 }
    );
  }
}
