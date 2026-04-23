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
  return !(normalized === '' || normalized === 'false' || normalized === '0');
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
    const keep = isTruthy(getDataValue(data, key));
    rendered = rendered.replace(blockRe, (_, inner) => (keep ? inner : ''));
    openRe.lastIndex = 0;
  }

  rendered = rendered.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (full, key) => {
    const value = getDataValue(data, key);
    if (value === undefined || value === null || String(value).trim() === '') {
      return full;
    }
    return escapeHtml(value);
  });

  return sanitizeHtml(rendered);
}
