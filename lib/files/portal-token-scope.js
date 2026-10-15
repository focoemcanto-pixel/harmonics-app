// Escopo de um token do portal do cliente (/cliente/<token>, /contrato/<token>, /verify/<token>).
// O portal aceita os mesmos três tipos de token abaixo; os endpoints públicos de arquivo usam este
// escopo para só entregar arquivos do evento/contrato que o próprio portal já mostra.

function idsOf(values) {
  return new Set(values.map((value) => String(value || '').trim()).filter(Boolean));
}

export async function resolvePortalTokenScope(supabase, token) {
  const safeToken = String(token || '').trim();
  const empty = { eventIds: new Set(), precontractIds: new Set(), contractIds: new Set() };
  if (!supabase || !safeToken) return empty;

  const [precontractResp, contractResp, repertoireResp] = await Promise.all([
    supabase.from('precontracts').select('id, event_id').eq('public_token', safeToken).limit(5),
    supabase.from('contracts').select('id, event_id, precontract_id').eq('public_token', safeToken).limit(5),
    supabase.from('repertoire_config').select('event_id').eq('client_public_token', safeToken).limit(5),
  ]);

  const precontracts = Array.isArray(precontractResp?.data) ? precontractResp.data : [];
  const contracts = Array.isArray(contractResp?.data) ? contractResp.data : [];
  const configs = Array.isArray(repertoireResp?.data) ? repertoireResp.data : [];

  return {
    eventIds: idsOf([
      ...precontracts.map((row) => row?.event_id),
      ...contracts.map((row) => row?.event_id),
      ...configs.map((row) => row?.event_id),
    ]),
    precontractIds: idsOf([
      ...precontracts.map((row) => row?.id),
      ...contracts.map((row) => row?.precontract_id),
    ]),
    contractIds: idsOf(contracts.map((row) => row?.id)),
  };
}

export function isContractInPortalScope(scope, contract) {
  if (!scope || !contract) return false;
  const id = String(contract.id || '');
  const precontractId = String(contract.precontract_id || '');
  const eventId = String(contract.event_id || '');
  return (
    (id && scope.contractIds.has(id)) ||
    (precontractId && scope.precontractIds.has(precontractId)) ||
    (eventId && scope.eventIds.has(eventId))
  );
}

export function isPaymentInPortalScope(scope, payment) {
  if (!scope || !payment) return false;
  const eventId = String(payment.event_id || '');
  return Boolean(eventId && scope.eventIds.has(eventId));
}
