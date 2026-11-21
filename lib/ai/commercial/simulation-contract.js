import { buildContractTemplateData } from '../../contracts/buildContractTemplateData.js';
import { resolvePrecontractHtmlSource, renderContractHtmlWithData } from '../../contracts/resolveContractHtmlSource.js';
import { closingPrecontractFields, hashSummary } from './closing.mjs';
import { resolveEventType } from './supervision.mjs';

const PERSONAL_FIELDS = [
  ['Nome completo', ['NOME', 'CLIENTE_NOME', 'client_name']],
  ['CPF', ['CPF', 'client_cpf']],
  ['RG', ['RG', 'client_rg']],
  ['Estado civil', ['ESTADO_CIVIL', 'client_marital_status']],
  ['Profissão', ['PROFISSAO', 'client_profession']],
  ['Endereço residencial', ['ENDERECO', 'client_address']],
];

export function simulationContractPending(name, address) {
  return [...PERSONAL_FIELDS.filter(([label]) => label !== 'Nome completo' || !name).map(([label]) => label),
    ...(!address ? ['Endereço do evento'] : [])];
}

export async function buildSimulationDocument({ supabase, workspaceId, closing, fallbackLead }) {
  const lead = closing.lead || fallbackLead;
  const summary = closing.summary;
  const eventType = await resolveEventType({ supabase, workspaceId, lead });
  if (!eventType?.default_contract_template_id) return null;
  const precontract = {
    ...closingPrecontractFields(summary, { eventType, templateId: eventType.default_contract_template_id }),
    workspace_id: workspaceId,
    client_name: lead.nome,
    location_name: summary.location,
    location_address: lead.endereco,
  };
  const { html: source, templateId } = await resolvePrecontractHtmlSource({ supabase, precontract });
  if (!source) return null;

  const data = buildContractTemplateData({ precontract });
  const payment = { deposit: data.VALOR_SINAL, balance: data.VALOR_SALDO, depositDate: data.DATA_SINAL, balanceDate: data.DATA_SALDO };
  const pending = simulationContractPending(lead.nome, lead.endereco);
  for (const [label, keys] of PERSONAL_FIELDS) {
    for (const key of keys) if (!data[key]) data[key] = '[Pendente: ' + label + ']';
  }
  Object.assign(data, {
    event_type: eventType.name,
    event_location_name: summary.location,
    event_location_address: lead.endereco || '[Pendente: Endereço do evento]',
  });
  if (!lead.endereco) data.event_location = data.LOCAL_EVENTO = [summary.location, data.event_location_address].filter(Boolean).join(' · ');
  const html = renderContractHtmlWithData(source, data);
  if (!html) return null;
  return { html, pending, payment, hash: await hashSummary({ templateId, html }) };
}

export const SIMULATION_DOCUMENT_CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-src 'none'";

export function simulationDocumentPage(html) {
  const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${SIMULATION_DOCUMENT_CSP}"><style>
    body { margin: 0 auto; padding: clamp(20px, 5vw, 44px); max-width: 760px; background: #fff; color: #201d2c; font-family: Georgia, serif; line-height: 1.58; overflow-wrap: anywhere }
    img, table { max-width: 100% } .simulation-notice { font: 600 13px system-ui; color: #5b338f; border-bottom: 1px solid #e6dcef; padding-bottom: 14px; margin-bottom: 24px }
  </style>`;
  const notice = '<p class="simulation-notice">Harmonics · Pré-contrato de teste · Sem assinatura</p>';
  if (/<head[^>]*>/i.test(html) && /<body[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (tag) => tag + head).replace(/<body[^>]*>/i, (tag) => tag + notice);
  }
  return '<!doctype html><html lang="pt-BR"><head>' + head + '</head><body>' + notice + html + '</body></html>';
}
