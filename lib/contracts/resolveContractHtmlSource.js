import { looksLikeHtml } from './templateImport';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeHtml(value) {
  let sanitized = String(value || '');
  sanitized = sanitized.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
  sanitized = sanitized.replace(/\son\w+\s*=\s*(["']).*?\1/gi, '');
  sanitized = sanitized.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
  sanitized = sanitized.replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
  return sanitized.trim();
}

function textToHtml(value) {
  const cleaned = String(value || '').replace(/\r\n/g, '\n').trim();
  if (!cleaned) return '';

  return cleaned
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('\n');
}

function hasValue(value) {
  return String(value || '').trim().length > 0;
}

function getDataValue(data, key) {
  if (!data || !key) return undefined;
  if (Object.prototype.hasOwnProperty.call(data, key)) return data[key];

  const upper = String(key).toUpperCase();
  const lower = String(key).toLowerCase();

  if (Object.prototype.hasOwnProperty.call(data, upper)) return data[upper];
  if (Object.prototype.hasOwnProperty.call(data, lower)) return data[lower];
  return undefined;
}

function isTruthy(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  return !(normalized === '' || normalized === 'false' || normalized === '0' || normalized === 'não' || normalized === 'nao');
}

const PLACEHOLDER_ALIASES = {
  client_name: ['NOME', 'CLIENTE_NOME'],
  client_marital_status: ['ESTADO_CIVIL'],
  client_profession: ['PROFISSAO'],
  client_cpf: ['CPF'],
  client_rg: ['RG'],
  client_address: ['ENDERECO'],
  event_type: ['TIPO_EVENTO', 'EVENTO_TIPO'],
  formation: ['FORMACAO'],
  instruments: ['INSTRUMENTOS'],
  event_date: ['DATA_EVENTO'],
  event_time: ['HORA_EVENTO'],
  event_location: ['LOCAL_EVENTO'],
  event_location_name: ['NOME_LOCAL_EVENTO', 'LOCAL_NOME'],
  event_location_address: ['ENDERECO_EVENTO', 'LOCAL_ENDERECO'],
  total_amount: ['VALOR_TOTAL'],
  total_amount_extenso: ['VALOR_TOTAL_EXTENSO'],
  deposit_amount: ['VALOR_SINAL'],
  balance_amount: ['VALOR_SALDO'],
  deposit_due_date: ['DATA_SINAL'],
  balance_due_date: ['DATA_SALDO'],
  card_due_date: ['DATA_CARTAO'],
  extras_text: ['EXTRAS_TEXTO'],
  reception_text: ['RECEPTIVO_TEXTO'],
  sound_text: ['SOM_TEXTO'],
  transport_text: ['TRANSPORTE_TEXTO'],
  client_signature: ['ASSINATURA'],
  accepted_name: ['ACEITE_NOME'],
  accepted_cpf: ['ACEITE_CPF'],
  accepted_datetime: ['ACEITE_DATAHORA'],
  accepted_ip: ['ACEITE_IP'],
  accepted_origin: ['ACEITE_ORIGEM'],
  contract_token: ['TOKEN_CONTRATO'],
  document_hash: ['HASH_DOCUMENTO'],
  signature_stamp: ['CARIMBO_ASSINATURA'],
};

const ESSENTIAL_PLACEHOLDERS = new Set([
  'client_name',
  'client_cpf',
  'client_rg',
  'client_address',
  'client_signature',
  'accepted_name',
  'accepted_cpf',
]);

const CONDITIONAL_ALIASES = {
  EXTRAS: ['extras', 'extras_text', 'EXTRAS_TEXTO'],
  CARTAO: ['cartao', 'card', 'payment_card', 'card_due_date', 'DATA_CARTAO'],
  SOM: ['som', 'sound', 'has_sound', 'sound_text', 'SOM_TEXTO'],
  RECEPTIVO: ['receptivo', 'reception', 'has_reception', 'reception_hours', 'reception_text', 'RECEPTIVO_TEXTO'],
  TRANSPORTE: ['transporte', 'transport', 'has_transport', 'transport_text', 'TRANSPORTE_TEXTO'],
  ANTESALA: ['antesala', 'antessala', 'has_antesala', 'antesala_text', 'ANTESALA_TEXTO'],
};

function shouldKeepConditionalBlock(data, key) {
  const normalized = String(key || '').trim();
  const candidates = [
    normalized,
    normalized.toLowerCase(),
    normalized.toUpperCase(),
    ...(CONDITIONAL_ALIASES[normalized.toUpperCase()] || []),
  ];

  return candidates.some((candidate) => isTruthy(getDataValue(data, candidate)));
}

function resolvePlaceholderValue(data, rawKey) {
  const key = String(rawKey || '').trim();
  if (!key) return '';

  const normalized = key.toLowerCase();
  const aliasEntry = Object.entries(PLACEHOLDER_ALIASES).find(
    ([canonical, aliases]) => canonical === normalized || aliases.includes(key)
  );

  const canonical = aliasEntry?.[0] || normalized;
  const aliases = PLACEHOLDER_ALIASES[canonical] || [];

  const candidates = [
    key,
    normalized,
    canonical,
    canonical.toUpperCase(),
    ...aliases,
  ];

  for (const candidate of candidates) {
    const value = getDataValue(data, candidate);
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value);
    }
  }

  return ESSENTIAL_PLACEHOLDERS.has(canonical) ? '__________' : '';
}

export function resolveContractHtmlSource(templateOrPrecontract) {
  const source = templateOrPrecontract || {};

  if (hasValue(source.custom_contract_rich_html)) {
    return {
      html: sanitizeHtml(source.custom_contract_rich_html),
      sourceField: 'custom_contract_rich_html',
    };
  }

  if (hasValue(source.source_rich_html)) {
    return {
      html: sanitizeHtml(source.source_rich_html),
      sourceField: 'source_rich_html',
    };
  }

  if (hasValue(source.custom_contract_content)) {
    return {
      html: looksLikeHtml(source.custom_contract_content)
        ? sanitizeHtml(source.custom_contract_content)
        : textToHtml(source.custom_contract_content),
      sourceField: 'custom_contract_content',
    };
  }

  if (hasValue(source.content)) {
    return {
      html: looksLikeHtml(source.content)
        ? sanitizeHtml(source.content)
        : textToHtml(source.content),
      sourceField: 'content',
    };
  }

  if (hasValue(source.source_text)) {
    return {
      html: textToHtml(source.source_text),
      sourceField: 'source_text',
    };
  }

  return { html: '', sourceField: null };
}

export function renderContractHtmlWithTemplateData(htmlInput, templateData) {
  const html = String(htmlInput || '');
  if (!html.trim()) return '';
  const data = templateData || {};

  let rendered = html;
  const openRe = /\{\{#([A-Za-z0-9_]+)\}\}/g;
  let match;

  while ((match = openRe.exec(rendered)) !== null) {
    const key = match[1];
    const blockRe = new RegExp(
      `\\{\\{#${key}\\}\\}([\\s\\S]*?)\\{\\{\\/${key}\\}\\}`,
      'g'
    );
    const keep = shouldKeepConditionalBlock(data, key);
    rendered = rendered.replace(blockRe, (_, inner) => (keep ? inner : ''));
    openRe.lastIndex = 0;
  }

  rendered = rendered.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (full, key) => {
    const value = resolvePlaceholderValue(data, key);
    return escapeHtml(value);
  });

  rendered = rendered.replace(/\{\{#[^}]+\}\}[\s\S]*?\{\{\/[^}]+\}\}/g, '');
  rendered = rendered.replace(/\{\{\/?[^}]+\}\}/g, '');

  return sanitizeHtml(rendered);
}

export const renderContractHtmlWithData = renderContractHtmlWithTemplateData;
