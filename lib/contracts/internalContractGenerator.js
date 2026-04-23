function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeInternalContractHtml(html) {
  let sanitized = String(html || '');

  sanitized = sanitized.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
  sanitized = sanitized.replace(/\son\w+\s*=\s*(["']).*?\1/gi, '');
  sanitized = sanitized.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
  sanitized = sanitized.replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');

  return sanitized.trim();
}

function buildFallbackInternalContractHtml(context) {
  const clientName =
    context?.contact?.name ||
    context?.precontract?.client_name ||
    context?.event?.client_name ||
    'Cliente';

  const eventDate =
    context?.event?.event_date ||
    context?.precontract?.event_date ||
    '—';

  const amount =
    context?.event?.agreed_amount ||
    context?.precontract?.agreed_amount ||
    context?.precontract?.value ||
    '—';

  return `
    <section data-contract-source="internal-fallback">
      <h1>Contrato Interno</h1>
      <p><strong>Cliente:</strong> ${escapeHtml(clientName)}</p>
      <p><strong>Data do evento:</strong> ${escapeHtml(eventDate)}</p>
      <p><strong>Valor:</strong> ${escapeHtml(amount)}</p>
    </section>
  `.trim();
}

export function generateInternalContract(context, templateData) {
  const customRichHtml = String(context?.precontract?.custom_contract_rich_html || '').trim();
  const customContent = String(context?.precontract?.custom_contract_content || '').trim();

  if (customRichHtml) {
    return {
      mode: 'internal',
      html: sanitizeInternalContractHtml(customRichHtml),
    };
  }

  if (customContent) {
    return {
      mode: 'internal',
      html: sanitizeInternalContractHtml(customContent),
    };
  }

  return {
    mode: 'internal',
    html: buildFallbackInternalContractHtml(context, templateData),
  };
}
