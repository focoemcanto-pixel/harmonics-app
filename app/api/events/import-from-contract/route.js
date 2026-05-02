import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import { saveExternalContractForEvent } from '@/lib/contracts/external-contract-flow';
import { sendAdminWhatsAppAlert } from '@/lib/whatsapp/send-admin-alert';
import { extractContractDataWithAi } from '@/lib/contracts/ai-contract-extractor';

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

function extractObjectBlock(rawText = '') {
  const text = String(rawText || '');
  const patterns = [
    /DO\s+OBJETO\s+DO\s+CONTRATO([\s\S]*?)(?:Dura[cç][aã]o\s+da\s+cerim[oô]nia|$)/i,
    /Cl[aá]usula\s*1[ªa]?([\s\S]*?)(?:DOS\s+EQUIPAMENTOS|$)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function splitLocationAddressAndName(rawAddress = '') {
  const value = String(rawAddress || '').replace(/\s+/g, ' ').trim().replace(/[\.;]+$/, '');
  if (!value) return { location_address: '', location_name: '' };

  const parts = value.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2 && /\d/.test(parts[parts.length - 2] || '')) {
    const location_name = parts[parts.length - 1];
    const location_address = parts.slice(0, -1).join(' - ').trim();
    if (location_address && location_name) {
      return { location_address, location_name };
    }
  }

  return { location_address: value, location_name: '' };
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
  const rawText = String(text || '');
  const textBeforeContractor = rawText.split(/CONTRATADO:/i)[0] || rawText;
  const normalizedBeforeContractor = normalizeExtractedText(textBeforeContractor);
  const normalizedText = normalizeExtractedText(text);
  const objectBlock = extractObjectBlock(rawText);
  const normalizedObjectBlock = normalizeExtractedText(objectBlock);
  const client_name = findField(textBeforeContractor, /CONTRATANTE:\s*([^,\n]+)/i) || findField(normalizedBeforeContractor, /(?:contratante|cliente)\s*[:\-]\s*([^\n,]+)/i);
  const cpf = findField(normalizedText, /CPF.*?(\d{11})/i);
  const dateAndTimeMatch = objectBlock.match(/dia\s(\d{2}\/\d{2}\/\d{4}),\sàs\s(\d{2}:\d{2})/i);
  const eventDateBr = dateAndTimeMatch?.[1] || findField(normalizedObjectBlock, /dia\s*(\d{2}\/\d{2}\/\d{4})/i);
  const event_time = dateAndTimeMatch?.[2] || findField(normalizedObjectBlock, /(?:hor[aá]rio|hora)\s*[:\-]\s*(\d{1,2}:\d{2})/i);
  const locationAddressRaw = findField(objectBlock, /no\s+endere[cç]o\s*:\s*([\s\S]*?)(?:\.\s|Mais\s+\d+\s*hrs?|Dura[cç][aã]o|O\s+som|$)/i) || '';
  const parsedLocation = splitLocationAddressAndName(locationAddressRaw);
  const location_address = parsedLocation.location_address;
  const location_name = (parsedLocation.location_name || findField(normalizedObjectBlock, /(?:local|espa[cç]o)\s*[:\-]\s*([^\n]+)/i)).replace(/\.$/, '').replace(/\bsantorini\b/i, 'Santorini');
  const reception_hours = findField(normalizedObjectBlock, /(\d+)\s*hrs?\s*de\s*receptivo/i) || (/(?:\breceptiv)/i.test(normalizedObjectBlock) ? '1' : '');
  const formationMatch = findField(normalizedObjectBlock, /(quarteto|trio|duo)/i);
  const instrumentistasConteudo = findField(normalizedObjectBlock, /instrumentistas\s*\((.*?)\)/i);
  const instruments = instrumentistasConteudo
    ? instrumentistasConteudo
        .replace(/\bdois\b/gi, '')
        .replace(/\bum\b/gi, '')
        .replace(/\(\s*\d+\s*\)/g, '')
        .replace(/\bpianista\b/gi, 'piano')
        .replace(/\bviolinista\b/gi, 'violino')
        .replace(/\bvocalista\b/gi, 'voz')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s*,\s*/g, ', ')
        .trim()
    : '';
  const instrumentsArray = instruments
    ? instruments
        .split(/\s*,\s*|\s+e\s+/i)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    : [];
  const instrumentoCount = instrumentsArray.filter((item) => item !== 'voz').length;
  const hasVoz = instrumentsArray.includes('voz');
  let formation = formationMatch ? formationMatch[0].toUpperCase() + formationMatch.slice(1).toLowerCase() : findField(normalizedObjectBlock, /forma[cç][aã]o\s*[:\-]\s*([^\n]+)/i);
  if (!formation && hasVoz) {
    if (instrumentoCount === 2) formation = 'Trio';
    if (instrumentoCount === 1) formation = 'Duo';
    if (instrumentoCount === 3) formation = 'Quarteto';
  }
  const has_sound = /som\s+est[áa]\s+incluso/i.test(normalizedObjectBlock);
  const agreed_amount = (textBeforeContractor.match(/R\$\s?[\d\.]+(?:,\d{2})?/i)?.[0] || '').replace(/^R\$\s?/i, '') || findField(normalizedBeforeContractor, /(?:valor contratado|valor)\s*[:\-]\s*R?\$?\s*([\d\.,]+)/i);
  const observations = findField(normalizedText, /(50%\s*at[ée][^\.]+\.)/i);
  const eventTypeMatch = objectBlock.match(/em um\s+([a-zà-úç]+)\s+que será realizado/i) || objectBlock.match(/(?:cerim[oô]nia|evento)\s+de\s+([a-zà-úç]+)/i);
  const event_type = eventTypeMatch?.[1] || '';

  console.log('[EXTRACT] endereco:', location_address);
  console.log('[EXTRACT] formacao:', formation);
  console.log('[EXTRACT] instrumentos:', instruments);

  const extractedData = { client_name, cpf, whatsapp_phone: findField(normalizedText, /(?:whatsapp|telefone|celular)\s*[:\-]\s*([^\n]+)/i), event_type, event_date: toIsoDate(eventDateBr), event_time, duration_min: findField(normalizedText, /dura[cç][aã]o\s*[:\-]\s*(\d{1,3})/i), location_name, location_address, formation, instruments, reception_hours, has_sound, agreed_amount, observations, status: 'Confirmado' };
  console.log('[EXTRACTED_DATA]', extractedData);
  return extractedData;
}

function getEssentialMissingFields(data = {}) {
  const missing = [];
  if (!String(data.event_type || '').trim()) missing.push('event_type');
  if (!String(data.event_time || '').trim()) missing.push('event_time');
  const hasLocationName = Boolean(String(data.location_name || '').trim());
  const hasLocationAddress = Boolean(String(data.location_address || '').trim());
  if (!hasLocationName && !hasLocationAddress) {
    missing.push('location_name', 'location_address');
  }
  if (!String(data.formation || '').trim()) missing.push('formation');
  if (!String(data.instruments || '').trim()) missing.push('instruments');
  return missing;
}
function validateMinimum(d) {
  const m = [];
  if (!String(d.client_name || '').trim()) m.push('client_name');
  if (!String(d.event_type || '').trim()) m.push('event_type');
  if (!String(d.event_date || '').trim()) m.push('event_date');
  if (!String(d.event_time || '').trim()) m.push('event_time');
  if (!String(d.location_name || '').trim() && !String(d.location_address || '').trim()) m.push('location_name_or_address');
  const hasAmount = Boolean(String(d.agreed_amount || '').trim());
  const hasFormationAndInstruments = Boolean(String(d.formation || '').trim()) && Boolean(String(d.instruments || '').trim());
  if (!hasAmount && !hasFormationAndInstruments) m.push('agreed_amount_or_formation_instruments');
  return m;
}

function looksLikeFullAddress(value = '') {
  const normalized = normalizeExtractedText(value);
  if (!normalized) return false;
  const hasStreetWord = /\b(rua|r\.|avenida|av\.?|rodovia|travessa|alameda|estrada|pra[cç]a)\b/i.test(normalized);
  const hasNumber = /\b\d{1,6}\b/.test(normalized);
  const hasCep = /\b\d{5}-?\d{3}\b/.test(normalized);
  const hasCityUf = /\b[a-zà-úç\s]+\/[a-z]{2}\b/i.test(normalized);
  const hasBairro = /\b(bairro|jd\.?|jardim|centro)\b/i.test(normalized);
  return (hasStreetWord && hasNumber) || hasCep || hasCityUf || (hasStreetWord && hasBairro);
}

function splitAddressAndVenue(value = '') {
  const cleaned = String(value || '').replace(/\s+/g, ' ').trim().replace(/[\.;]+$/, '');
  if (!cleaned) return { location_name: '', location_address: '' };
  const parts = cleaned.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const maybeAddress = parts.slice(0, -1).join(' - ').trim();
    const maybeVenue = parts[parts.length - 1];
    if (looksLikeFullAddress(maybeAddress) && !looksLikeFullAddress(maybeVenue)) {
      return { location_address: maybeAddress, location_name: maybeVenue };
    }
  }
  return { location_name: '', location_address: cleaned };
}

function normalizeInstruments(value = '') {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/\bpianista\b/g, 'piano')
    .replace(/\bviolinista\b/g, 'violino')
    .replace(/\bviolonista\b/g, 'violão')
    .replace(/\bvocalista\b/g, 'voz');
  const items = normalized.split(/\s*,\s*|\s+e\s+/i).map((item) => item.trim()).filter(Boolean);
  const unique = [];
  items.forEach((item) => {
    if (!unique.includes(item)) unique.push(item);
  });
  if (!unique.length) return '';
  if (unique.length === 1) return unique[0].charAt(0).toUpperCase() + unique[0].slice(1);
  const head = unique.slice(0, -1).join(', ');
  const tail = unique[unique.length - 1];
  return `${head.charAt(0).toUpperCase()}${head.slice(1)} e ${tail}`;
}

function normalizeFinalExtractedData(finalData = {}, text = '') {
  const normalizedText = normalizeExtractedText(text);
  const normalized = { ...finalData };

  const locationName = String(normalized.location_name || '').trim();
  const locationAddress = String(normalized.location_address || '').trim();
  if (locationName && locationAddress && normalizeExtractedText(locationName) === normalizeExtractedText(locationAddress)) {
    if (!looksLikeFullAddress(locationName)) {
      normalized.location_name = locationName;
      normalized.location_address = '';
    } else {
      const split = splitAddressAndVenue(locationName);
      normalized.location_address = split.location_address;
      normalized.location_name = split.location_name;
    }
  }

  if (/\b(som\s+est[áa]\s+incluso|som\s+incluso|sistema\s+de\s+som\s+incluso|som\s+est[áa]\s+inclu[íi]do)\b/i.test(normalizedText)) {
    normalized.has_sound = true;
  }

  normalized.instruments = normalizeInstruments(normalized.instruments);
  const instrumentsArray = String(normalized.instruments || '').toLowerCase().split(/\s*,\s*|\s+e\s+/i).map((item) => item.trim()).filter(Boolean);
  const instrumentCount = instrumentsArray.filter((item) => item !== 'voz').length;
  const hasVoice = instrumentsArray.includes('voz');
  if (!String(normalized.formation || '').trim() && hasVoice) {
    if (instrumentCount === 3) normalized.formation = 'Quarteto';
    if (instrumentCount === 2) normalized.formation = 'Trio';
    if (instrumentCount === 1) normalized.formation = 'Duo';
  }
  return normalized;
}

export async function POST(request) {
  const supabase = getSupabaseAdmin();
  try {
    const auth = await requireAdmin({ supabase, request, logPrefix: '[IMPORT_FROM_CONTRACT_API]' });
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
    const form = await request.formData(); const file = form.get('file'); const mode = String(form.get('mode') || 'extract').trim();
    if (!file || typeof file === 'string') return NextResponse.json({ ok: false, error: 'Arquivo PDF é obrigatório.' }, { status: 400 });
    if (file.type !== 'application/pdf') return NextResponse.json({ ok: false, error: 'Apenas PDF (application/pdf) é aceito.' }, { status: 400 });
    if (file.size > MAX_PDF_SIZE_BYTES) return NextResponse.json({ ok: false, error: 'PDF excede o limite de 15MB.' }, { status: 400 });

    const reviewedData = JSON.parse(String(form.get('reviewedData') || '{}'));

    console.log('FILE SIZE:', file.size);
    console.log('FILE TYPE:', file.type);
    const manualMinimumMissing = validateMinimum(reviewedData || {});
    const canBypassAutoExtraction = mode === 'confirm' && manualMinimumMissing.length === 0;

    const text = canBypassAutoExtraction ? '' : await extractPdfTextWithContractService(file);
    console.log('[PDF_TEXT_LENGTH]', text.length);
    console.log('[PDF_SAMPLE]', text.slice(0, 300));
    if (!canBypassAutoExtraction && !text.length) {
      return NextResponse.json({ ok: false, message: 'Não foi possível extrair texto do PDF', extractionConfidence: 0 }, { status: 422 });
    }
    if (!canBypassAutoExtraction && text.length < 100) {
      return NextResponse.json({
        ok: false,
        message: 'Não foi possível identificar dados automaticamente. Preencha manualmente.',
        extractionConfidence: 0,
      });
    }
    const extractedData = canBypassAutoExtraction ? {} : buildExtraction(text);
    const essentialMissingFields = getEssentialMissingFields(extractedData);
    const shouldUseAi = essentialMissingFields.length > 0;
    let aiUsed = false;
    let aiModel = null;
    let aiResult = { aiData: {} };
    let finalData = extractedData;
    if (!canBypassAutoExtraction && shouldUseAi) {
      try {
        aiResult = await extractContractDataWithAi({ text, missingFields: essentialMissingFields });
        aiUsed = aiResult.aiUsed;
        aiModel = aiResult.model || null;
        if (aiUsed) {
          const merged = { ...extractedData };
          Object.keys(aiResult.aiData || {}).forEach((key) => {
            const shouldFill = essentialMissingFields.includes(key) || !String(merged[key] ?? '').trim();
            if (shouldFill && String(merged[key] ?? '').trim() === '') merged[key] = aiResult.aiData[key];
          });
          finalData = merged;
        }
      } catch (aiError) {
        await sendAdminWhatsAppAlert(`⚠️ Falha IA no import-from-contract: ${aiError?.message || 'erro desconhecido'}`);
      }
    }
    finalData = canBypassAutoExtraction ? finalData : normalizeFinalExtractedData(finalData, text);
    const finalMissingFields = validateMinimum(finalData);
    const finalEssentialMissingFields = getEssentialMissingFields(finalData);
    const finalExtractedFieldCount = Object.values(finalData).filter((value) => {
      if (typeof value === 'boolean') return value;
      return Boolean(String(value || '').trim());
    }).length;
    const extractionStatus = pickStatus(finalExtractedFieldCount);
    const extractionConfidence = finalMissingFields.length <= 2 ? 90 : 70;

    console.info('[IMPORT_FROM_CONTRACT_AI]', {
      shouldUseAi,
      aiUsed,
      aiModel,
      essentialMissingFieldsBeforeAi: essentialMissingFields,
      essentialMissingFieldsAfterAi: finalEssentialMissingFields,
      aiReturnedKeys: Object.keys(aiResult.aiData || {}),
    });

    console.info('[IMPORT_FROM_CONTRACT_API] extraction', {
      fileName: file.name,
      fileSize: file.size,
      textLength: text.length,
      firstTextSample: text.slice(0, 300),
      extractionMethod: 'contract_service_extract_pdf_text',
      missingFields: finalMissingFields,
      aiUsed,
      model: aiModel,
      confidence: extractionConfidence,
    });
    if (mode === 'extract') {
      const meetsMinimumAuto = ['client_name', 'event_date', 'event_time', 'event_type'].every((field) => Boolean(String(finalData[field] || '').trim()))
        && (Boolean(String(finalData.location_name || '').trim()) || Boolean(String(finalData.location_address || '').trim()));
      if (!finalExtractedFieldCount) {
        return NextResponse.json({ ok: true, extractedData: {}, extractionConfidence: 0, missingFields: finalMissingFields, warning: 'Preenchimento manual necessário', extractionStatus: 'manual_required' });
      }
      return NextResponse.json({ ok: true, extractedData: finalData, missingFields: finalMissingFields, extractionMethod: aiUsed ? 'ai_fallback' : 'regex', aiUsed, confidence: extractionConfidence, extractionConfidence, extractionStatus: text.length > 300 && meetsMinimumAuto ? extractionStatus : 'manual_required', warning: text.length > 300 && meetsMinimumAuto ? null : 'Preenchimento manual necessário' });
    }

    const normalized = canBypassAutoExtraction ? { ...reviewedData } : { ...finalData, ...reviewedData }; const missing = validateMinimum(normalized);
    if (missing.length) return NextResponse.json({ ok: false, error: 'Campos mínimos obrigatórios não confirmados.', missingFields: missing }, { status: 400 });
    const agreedAmount = parseMoney(normalized.agreed_amount);
    const { data: event, error: eventError } = await supabase.from('events').insert({ client_name: String(normalized.client_name || '').trim(), event_type: normalized.event_type || null, event_date: normalized.event_date || null, event_time: normalized.event_time || null, duration_min: Number(normalized.duration_min || 60), location_name: normalized.location_name || normalized.location_address || null, location_address: normalized.location_address || null, formation: normalized.formation || null, instruments: normalized.instruments || null, reception_hours: Number(normalized.reception_hours || 0), has_sound: Boolean(normalized.has_sound), agreed_amount: agreedAmount, payment_status: 'Pendente', status: normalized.status || 'Confirmado', whatsapp_name: normalized.client_name || null, whatsapp_phone: normalized.whatsapp_phone || null, observations: normalized.observations || null, open_amount: agreedAmount, paid_amount: 0, costs_source: 'default' }).select('id, client_contact_id').single();
    if (eventError) throw eventError;

    const result = await saveExternalContractForEvent({ supabase, eventId: event.id, file, contactId: event.client_contact_id, rawPayload: { external_contract: true, external_contract_source: 'admin_upload_from_event_creation', regex_extracted_contract_data: extractedData, final_extracted_contract_data: finalData, extracted_contract_data: finalData, ai_used: aiUsed, ai_model: aiModel, extraction_confidence: extractionConfidence, admin_reviewed_at: new Date().toISOString() } });
    return NextResponse.json({ ok: true, eventId: event.id, contractId: result.contract.id, pdfUrl: result.pdfUrl, clientPanelLink: result.clientPanelLink });
  } catch (error) {
    await sendAdminWhatsAppAlert(`🚨 Erro crítico em import-from-contract: ${error?.message || 'erro desconhecido'}`);
    return NextResponse.json({ ok: false, error: error?.message || 'Falha no fluxo de importação.' }, { status: error?.status || 500 });
  }
}
