const PLACEHOLDER_ALIAS_MAP = {
  NOME: 'client_name',
  ESTADO_CIVIL: 'client_marital_status',
  PROFISSAO: 'client_profession',
  CPF: 'client_cpf',
  RG: 'client_rg',
  ENDERECO: 'client_address',
  FORMACAO: 'formation',
  INSTRUMENTOS: 'instruments',
  DATA_EVENTO: 'event_date',
  HORA_EVENTO: 'event_time',
  LOCAL_EVENTO: 'event_location',
  VALOR_TOTAL: 'total_amount',
  VALOR_TOTAL_EXTENSO: 'total_amount_extenso',
  DATA_SINAL: 'deposit_due_date',
  DATA_SALDO: 'balance_due_date',
  DATA_CARTAO: 'card_due_date',
  EXTRAS_TEXTO: 'extras_text',
  ASSINATURA: 'client_signature',
  ACEITE_CPF: 'accepted_cpf',
  TOKEN_CONTRATO: 'contract_token',
  ACEITE_NOME: 'accepted_name',
  ACEITE_DATAHORA: 'accepted_datetime',
  ACEITE_IP: 'accepted_ip',
  ACEITE_ORIGEM: 'accepted_origin',
  HASH_DOCUMENTO: 'document_hash',
  CARIMBO_ASSINATURA: 'signature_stamp',
};

const CONDITIONAL_ALIAS_MAP = {
  EXTRAS: 'EXTRAS',
  CARTAO: 'CARTAO',
};

const KNOWN_PLACEHOLDERS = new Set(Object.values(PLACEHOLDER_ALIAS_MAP));

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
  sanitized = sanitized.replace(/<(iframe|object|embed)[\s\S]*?>[\s\S]*?<\/\1>/gi, '');
  sanitized = sanitized.replace(/\son\w+\s*=\s*(["']).*?\1/gi, '');
  sanitized = sanitized.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
  sanitized = sanitized.replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
  sanitized = sanitized.replace(/(href|src)\s*=\s*javascript:[^\s>]+/gi, '$1="#"');

  const allowedTags = new Set([
    'p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u',
    'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'span',
    'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr',
  ]);
  const allowedStyles = new Set([
    'text-align',
    'font-weight',
    'font-style',
    'text-decoration',
    'margin',
    'padding',
    'line-height',
    'font-size',
    'white-space',
  ]);

  sanitized = sanitized.replace(/<([^>\s/!]+)([^>]*)>/gi, (full, tagName, attributes = '') => {
    const normalizedTag = String(tagName || '').toLowerCase();
    if (!allowedTags.has(normalizedTag)) return '';

    let nextAttributes = String(attributes || '');
    nextAttributes = nextAttributes.replace(/\sstyle\s*=\s*(["'])([\s\S]*?)\1/gi, (_, quote, styleValue) => {
      const safeStyle = String(styleValue || '')
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const [rawProp, ...rest] = part.split(':');
          const prop = String(rawProp || '').trim().toLowerCase();
          const valuePart = rest.join(':').trim();
          if (!allowedStyles.has(prop) || !valuePart) return null;
          if (/javascript:/i.test(valuePart)) return null;
          return `${prop}: ${valuePart}`;
        })
        .filter(Boolean)
        .join('; ');

      return safeStyle ? ` style=${quote}${safeStyle}${quote}` : '';
    });

    return `<${normalizedTag}${nextAttributes}>`;
  });

  sanitized = sanitized.replace(/<\/([^>\s]+)>/gi, (full, tagName) => {
    const normalizedTag = String(tagName || '').toLowerCase();
    if (!allowedTags.has(normalizedTag)) return '';
    return `</${normalizedTag}>`;
  });
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

export function looksLikeHtml(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  return /<([a-z][a-z0-9]*)\b[^>]*>/i.test(text);
}

export function parseContractTemplateInput(rawText) {
  const source = String(rawText || '');
  const isHtmlInput = looksLikeHtml(source);
  let working = source;

  const detectedPlaceholders = new Set();
  const unknownPlaceholders = new Set();
  const detectedConditionals = new Set();

  working = working.replace(/{{\s*#\s*([A-Za-z0-9_]+)\s*}}/g, (_, rawName) => {
    const normalizedKey = String(rawName || '').trim().toUpperCase();
    const mapped = CONDITIONAL_ALIAS_MAP[normalizedKey] || normalizedKey;
    detectedConditionals.add(mapped);
    return `{{#${mapped}}}`;
  });

  working = working.replace(/{{\s*\/\s*([A-Za-z0-9_]+)\s*}}/g, (_, rawName) => {
    const normalizedKey = String(rawName || '').trim().toUpperCase();
    const mapped = CONDITIONAL_ALIAS_MAP[normalizedKey] || normalizedKey;
    detectedConditionals.add(mapped);
    return `{{/${mapped}}}`;
  });

  working = working.replace(/{{\s*([A-Za-z0-9_]+)\s*}}/g, (_, rawName) => {
    const token = String(rawName || '').trim();
    const upperToken = token.toUpperCase();
    const mapped = PLACEHOLDER_ALIAS_MAP[upperToken] || token;
    const isKnown = Boolean(PLACEHOLDER_ALIAS_MAP[upperToken]) || KNOWN_PLACEHOLDERS.has(token);

    if (isKnown) {
      detectedPlaceholders.add(mapped);
    } else {
      unknownPlaceholders.add(token);
    }

    return `{{${mapped}}}`;
  });

  return {
    rawText: source,
    normalizedContent: isHtmlInput ? sanitizeHtml(working) : textToHtml(working),
    detectedPlaceholders: Array.from(detectedPlaceholders),
    unknownPlaceholders: Array.from(unknownPlaceholders),
    conditionals: Array.from(detectedConditionals),
    hasConditionals: detectedConditionals.size > 0,
  };
}
