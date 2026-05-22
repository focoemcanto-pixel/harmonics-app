import { renderContractHtmlWithTemplateData, resolveContractHtmlSource } from './resolveContractHtmlSource';

export function generateInternalContract(context, templateData, options = {}) {
  const allowFallback = options?.allowFallback === true;
  const resolved = resolveContractHtmlSource(context?.precontract || {});
  const htmlWithData = renderContractHtmlWithTemplateData(resolved.html, templateData);

  if (htmlWithData) {
    return {
      mode: 'internal',
      html: htmlWithData,
      source: resolved.source || 'precontract',
    };
  }

  if (!allowFallback) {
    return {
      mode: 'internal',
      html: '',
      source: 'missing',
      error: 'MISSING_INTERNAL_CONTRACT_HTML',
      message: 'Contrato interno sem HTML/template real. Não é seguro gerar PDF com fallback genérico.',
    };
  }

  const clientName =
    context?.contact?.name ||
    context?.precontract?.client_name ||
    context?.event?.client_name ||
    'Cliente';
  const eventDate = context?.event?.event_date || context?.precontract?.event_date || '—';
  const amount = context?.event?.agreed_amount || context?.precontract?.agreed_amount || context?.precontract?.value || '—';

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  return {
    mode: 'internal',
    source: 'internal-fallback',
    html: `
      <section data-contract-source="internal-fallback">
        <h1>Contrato Interno</h1>
        <p><strong>Cliente:</strong> ${escapeHtml(clientName)}</p>
        <p><strong>Data do evento:</strong> ${escapeHtml(eventDate)}</p>
        <p><strong>Valor:</strong> ${escapeHtml(amount)}</p>
      </section>
    `.trim(),
  };
}
