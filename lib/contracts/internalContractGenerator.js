function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => escapeHtml(line))
    .join('<br />');
}

function buildFallbackInternalContractHtml(context, templateData) {
  const clientName =
    context?.contact?.name ||
    context?.precontract?.client_name ||
    context?.event?.client_name ||
    'Cliente';

  const eventDate =
    context?.event?.event_date ||
    context?.precontract?.event_date ||
    '—';

  const eventType =
    context?.event?.event_type ||
    context?.precontract?.event_type ||
    '—';

  const amount =
    context?.event?.agreed_amount ||
    context?.precontract?.agreed_amount ||
    context?.precontract?.value ||
    '—';

  return `
    <section data-contract-source="internal-fallback">
      <h1>Contrato - ${escapeHtml(clientName)}</h1>
      <p><strong>Data do evento:</strong> ${escapeHtml(eventDate)}</p>
      <p><strong>Tipo de evento:</strong> ${escapeHtml(eventType)}</p>
      <p><strong>Valor:</strong> ${escapeHtml(amount)}</p>
      <hr />
      <p>Este contrato está no modo interno e ainda não possui conteúdo personalizado salvo.</p>
      <p>Use o campo de conteúdo personalizado do pré-contrato para substituir este texto na próxima etapa.</p>
      <details>
        <summary>Dados do template gerado</summary>
        <pre>${escapeHtml(JSON.stringify(templateData || {}, null, 2))}</pre>
      </details>
    </section>
  `.trim();
}

export function generateInternalContract(context, templateData) {
  const customContent = String(context?.precontract?.custom_contract_content || '').trim();

  if (customContent) {
    return {
      mode: 'internal',
      source: 'custom_contract_content',
      html: `<section data-contract-source="custom-contract-content">${nl2br(customContent)}</section>`,
    };
  }

  return {
    mode: 'internal',
    source: 'fallback',
    html: buildFallbackInternalContractHtml(context, templateData),
  };
}
