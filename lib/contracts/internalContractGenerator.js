import { renderContractHtmlWithTemplateData, resolveContractHtmlSource } from './resolveContractHtmlSource';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  const resolved = resolveContractHtmlSource(context?.precontract || {});
  const htmlWithData = renderContractHtmlWithTemplateData(resolved.html, templateData);

  if (htmlWithData) {
    return {
      mode: 'internal',
      html: htmlWithData,
    };
  }

  return {
    mode: 'internal',
    html: buildFallbackInternalContractHtml(context, templateData),
  };
}
