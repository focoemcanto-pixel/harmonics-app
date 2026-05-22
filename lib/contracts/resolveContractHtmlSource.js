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

function cleanTemplateArtifacts(value) {
  let cleaned = String(value || '');

  cleaned = cleaned.replace(/\{\{\s*else\s*\}\}/gi, '');
  cleaned = cleaned.replace(/\{\{\s*#?if\s+[^}]+\}\}/gi, '');
  cleaned = cleaned.replace(/\{\{\s*\/if\s*\}\}/gi, '');
  cleaned = cleaned.replace(/\{\{\s*#?each\s+[^}]+\}\}/gi, '');
  cleaned = cleaned.replace(/\{\{\s*\/each\s*\}\}/gi, '');
  cleaned = cleaned.replace(/\{\{#[^}]+\}\}[\s\S]*?\{\{\/[^}]+\}\}/g, '');
  cleaned = cleaned.replace(/\{\{\/?[^}]+\}\}/g, '');

  cleaned = cleaned.replace(/(^|>)(\s*)\}(\s*)(?=<|$)/g, '$1');
  cleaned = cleaned.replace(/(<br\s*\/?>\s*)\}(\s*)(?=<|$)/gi, '$1');
  cleaned = cleaned.replace(/(<\/p>\s*)\}(\s*)(?=<|$)/gi, '$1');
  cleaned = cleaned.replace(/(<\/li>\s*)\}(\s*)(?=<|$)/gi, '$1');
  cleaned = cleaned.replace(/\n\s*\}\s*\n/g, '\n');
  cleaned = cleaned.replace(/(^|\n)\s*\}\s*($|\n)/g, '$1');

  return cleaned.trim();
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
  client_name: ['NOME', 'CLIENTE_NOME', 'nome', 'cliente_nome', 'contratante_nome', 'NOME_CONTRATANTE'],
  nome: ['NOME', 'CLIENTE_NOME', 'client_name', 'cliente_nome', 'contratante_nome', 'NOME_CONTRATANTE'],
  cliente_nome: ['NOME', 'CLIENTE_NOME', 'client_name', 'nome', 'contratante_nome', 'NOME_CONTRATANTE'],
  contratante_nome: ['NOME', 'CLIENTE_NOME', 'client_name', 'nome', 'cliente_nome', 'NOME_CONTRATANTE'],
  client_marital_status: ['ESTADO_CIVIL', 'estado_civil', 'contratante_estado_civil', 'CLIENTE_ESTADO_CIVIL', 'NOME_ESTADO_CIVIL'],
  estado_civil: ['ESTADO_CIVIL', 'client_marital_status', 'contratante_estado_civil', 'CLIENTE_ESTADO_CIVIL'],
  contratante_estado_civil: ['ESTADO_CIVIL', 'estado_civil', 'client_marital_status', 'CLIENTE_ESTADO_CIVIL'],
  client_profession: ['PROFISSAO', 'profissao', 'profissão', 'contratante_profissao', 'CLIENTE_PROFISSAO', 'PROFISSÃO'],
  profissao: ['PROFISSAO', 'client_profession', 'contratante_profissao', 'CLIENTE_PROFISSAO', 'PROFISSÃO'],
  contratante_profissao: ['PROFISSAO', 'profissao', 'client_profession', 'CLIENTE_PROFISSAO', 'PROFISSÃO'],
  client_cpf: ['CPF', 'cpf', 'contratante_cpf', 'CLIENTE_CPF', 'CPF_CONTRATANTE'],
  cpf: ['CPF', 'client_cpf', 'contratante_cpf', 'CLIENTE_CPF', 'CPF_CONTRATANTE'],
  contratante_cpf: ['CPF', 'cpf', 'client_cpf', 'CLIENTE_CPF', 'CPF_CONTRATANTE'],
  client_rg: ['RG', 'rg', 'contratante_rg', 'CLIENTE_RG', 'RG_CONTRATANTE'],
  rg: ['RG', 'client_rg', 'contratante_rg', 'CLIENTE_RG', 'RG_CONTRATANTE'],
  contratante_rg: ['RG', 'rg', 'client_rg', 'CLIENTE_RG', 'RG_CONTRATANTE'],
  client_address: ['ENDERECO', 'endereco', 'endereço', 'contratante_endereco', 'CLIENTE_ENDERECO', 'ENDEREÇO', 'ENDERECO_CONTRATANTE'],
  endereco: ['ENDERECO', 'client_address', 'contratante_endereco', 'CLIENTE_ENDERECO', 'ENDEREÇO', 'ENDERECO_CONTRATANTE'],
  contratante_endereco: ['ENDERECO', 'endereco', 'client_address', 'CLIENTE_ENDERECO', 'ENDEREÇO', 'ENDERECO_CONTRATANTE'],
  event_type: ['TIPO_EVENTO', 'EVENTO_TIPO', 'tipo_evento'],
  formation: ['FORMACAO', 'formacao', 'formação'],
  formacao: ['FORMACAO', 'formation'],
  instruments: ['INSTRUMENTOS', 'instrumentos'],
  event_date: ['DATA_EVENTO', 'data_evento'],
  event_time: ['HORA_EVENTO', 'hora_evento'],
  event_location: ['LOCAL_EVENTO', 'local_evento'],
  event_location_name: ['NOME_LOCAL_EVENTO', 'LOCAL_NOME', 'nome_local_evento', 'local_nome'],
  event_location_address: ['ENDERECO_EVENTO', 'LOCAL_ENDERECO', 'endereco_evento', 'local_endereco'],
  total_amount: ['VALOR_TOTAL', 'valor_total'],
  total_amount_extenso: ['VALOR_TOTAL_EXTENSO', 'valor_total_extenso'],
  deposit_amount: ['VALOR_SINAL', 'valor_sinal'],
  balance_amount: ['VALOR_SALDO', 'valor_saldo'],
  deposit_due_date: ['DATA_SINAL', 'data_sinal'],
  balance_due_date: ['DATA_SALDO', 'data_saldo'],
  card_due_date: ['DATA_CARTAO', 'data_cartao'],
  extras_text: ['EXTRAS_TEXTO', 'extras_texto'],
  reception_text: ['RECEPTIVO_TEXTO', 'receptivo_texto'],
  sound_text: ['SOM_TEXTO', 'som_texto'],
  transport_text: ['TRANSPORTE_TEXTO', 'transporte_texto'],
  client_signature: ['ASSINATURA', 'assinatura'],
  accepted_name: ['ACEITE_NOME', 'aceite_nome'],
  accepted_cpf: ['ACEITE_CPF', 'aceite_cpf'],
  accepted_datetime: ['ACEITE_DATAHORA', 'aceite_datahora'],
  accepted_ip: ['ACEITE_IP', 'aceite_ip'],
  accepted_origin: ['ACEITE_ORIGEM', 'aceite_origem'],
  contract_token: ['TOKEN_CONTRATO', 'token_contrato'],
  document_hash: ['HASH_DOCUMENTO', 'hash_documento'],
  signature_stamp: ['CARIMBO_ASSINATURA', 'carimbo_assinatura'],
};

const ESSENTIAL_PLACEHOLDERS = new Set([
  'client_name',
  'nome',
  'cliente_nome',
  'contratante_nome',
  'client_cpf',
  'cpf',
  'contratante_cpf',
  'client_rg',
  'rg',
  'contratante_rg',
  'client_address',
  'endereco',
  'contratante_endereco',
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
    ([canonical, aliases]) => canonical === normalized || aliases.includes(key) || aliases.includes(normalized)
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
      `\\{\\{#${key}\\}\\}([\\s\\S]*?)\\{\\{\\/${key}\\}`,
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

  rendered = cleanTemplateArtifacts(rendered);

  return sanitizeHtml(rendered);
}

export const renderContractHtmlWithData = renderContractHtmlWithTemplateData;
