import { buildSignedContractHtml, extractSignerIp } from '@/lib/contracts/premiumSignature';
import { generateAndSaveInternalContractPdf } from '@/lib/contracts/internalPdfFlow';
import { logError, logInfo } from '@/lib/observability/server-log';

function asString(value) { return String(value || '').trim(); }
function maskCpf(cpf) { const d = asString(cpf).replace(/\D/g, ''); return d.length===11?`${d.slice(0,3)}.***.***-${d.slice(9)}`:'***.***.***-**'; }

async function updateContractWithFallbacks({ supabase, contractId, patchPayload }) {
  const missingColumns = []; let currentPayload = { ...patchPayload };
  while (true) {
    const { error } = await supabase.from('contracts').update(currentPayload).eq('id', contractId);
    if (!error) return { missingColumns };
    const message = String(error.message || '');
    const match = message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of\s+relation\s+"?contracts"?\s+does\s+not\s+exist/i) || message.match(/Could not find the '([^']+)' column/i);
    const column = match?.[1] || '';
    if (!column || !Object.prototype.hasOwnProperty.call(currentPayload, column)) throw error;
    missingColumns.push(column); delete currentPayload[column];
  }
}

function throwWorkspaceError() {
  const e = new Error('Pré-contrato sem workspace_id. Não é possível gerar PDF.');
  e.status = 422;
  e.code = 'MISSING_WORKSPACE';
  throw e;
}

function buildContractSeedFromPrecontract({ precontract, token, workspaceId }) {
  if (!precontract?.id) return null;

  return {
    precontract_id: precontract.id,
    workspace_id: workspaceId,
    organization_id: precontract.organization_id || null,
    public_token: asString(precontract.public_token || token) || null,
    event_id: precontract.event_id || null,
    contact_id: precontract.contact_id || null,
    event_date: precontract.event_date || null,
    event_time: precontract.event_time || null,
    formation: precontract.formation || null,
    instruments: precontract.instruments || null,
    client_name: precontract.client_name || null,
    location_name: precontract.location_name || null,
    location_address: precontract.location_address || null,
    total_amount: precontract.total_amount ?? null,
    entry_amount: precontract.entry_amount ?? null,
    remaining_amount: precontract.remaining_amount ?? null,
    status: 'draft',
    raw_payload: {
      precontract_snapshot: precontract,
    },
  };
}

async function resolveSigningContext({ supabase, token, contractId, precontractId }) {
  let contract = null; let precontract = null;
  if (!precontract && token) { const { data } = await supabase.from('precontracts').select('*').eq('public_token', token).maybeSingle(); precontract = data || null; }
  const workspaceId = precontract?.workspace_id || null;
  if (!workspaceId) throwWorkspaceError();

  if (precontractId) {
    const { data } = await supabase.from('precontracts').select('*').eq('id', precontractId).eq('workspace_id', workspaceId).maybeSingle();
    if (!data || String(data.public_token || '') !== String(token || '')) {
      const e = new Error('Pré-contrato informado não pertence ao token/workspace.');
      e.status = 403;
      e.code = 'PRECONTRACT_SCOPE_MISMATCH';
      throw e;
    }
    precontract = data;
  }

  if (contractId) {
    const { data } = await supabase.from('contracts').select('*').eq('id', contractId).eq('workspace_id', workspaceId).maybeSingle();
    if (!data) {
      const e = new Error('Contrato informado não pertence ao precontract/workspace.');
      e.status = 403;
      e.code = 'CONTRACT_SCOPE_MISMATCH';
      throw e;
    }
    contract = data;
  }

  if (!contract && token) { const { data } = await supabase.from('contracts').select('*').eq('public_token', token).eq('workspace_id', workspaceId).maybeSingle(); contract = data || null; }
  if (!contract && precontract?.id) { const { data } = await supabase.from('contracts').select('*').eq('precontract_id', precontract.id).eq('workspace_id', workspaceId).maybeSingle(); contract = data || null; }

  if (contract && String(contract.precontract_id || '') !== String(precontract.id || '')) {
    const e = new Error('Contrato informado não pertence ao precontract/workspace.');
    e.status = 403;
    e.code = 'CONTRACT_SCOPE_MISMATCH';
    throw e;
  }

  if (!contract && precontract?.id) {
    const seedPayload = buildContractSeedFromPrecontract({ precontract, token, workspaceId });
    const inserted = await supabase.from('contracts').insert(seedPayload).select('*').single();

    if (inserted.error) {
      const { data: existingByPrecontract } = await supabase
        .from('contracts')
        .select('*')
        .eq('precontract_id', precontract.id)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (existingByPrecontract?.id) {
        contract = existingByPrecontract;
      } else {
        throw inserted.error;
      }
    } else {
      contract = inserted.data;
    }
  }
  if (!precontract && contract?.precontract_id) { const { data } = await supabase.from('precontracts').select('*').eq('id', contract.precontract_id).eq('workspace_id', workspaceId).maybeSingle(); precontract = data || null; }
  if (!contract?.id) throw new Error('Não foi possível criar ou recuperar contrato vinculado ao precontract.');
  return { contract, precontract, workspaceId };
}

export async function signInternalContract({ supabase, token, contractId, precontractId, html, signerName, signerCpf, origin, requestHeaders, ip, userAgent }) {
  const hasHtml = Boolean(asString(html));
  logInfo('PUBLIC_CONTRACT_SIGN_INTERNAL_HELPER_START', 'START', { contractId: contractId || null, precontractId: precontractId || null, hasHtml });
  try {
    if (!hasHtml) { const e = new Error('HTML assinado é obrigatório.'); e.status = 400; e.code='MISSING_HTML'; throw e; }
    const { contract, workspaceId } = await resolveSigningContext({ supabase, token, contractId, precontractId });
    const signedAt = new Date().toISOString();
    const signerIp = ip || extractSignerIp(requestHeaders || new Headers());
    const ua = asString(userAgent || requestHeaders?.get?.('user-agent')) || 'Não disponível';
    const validationToken = asString(token || contract.public_token);
    const signedDocument = await buildSignedContractHtml({ contractHtml: html, signerName, signerCpf, signedAt, signerIp, userAgent: ua, origin, contractId: contract.id, validationToken });
    const signatureMetadata = { origin, signer_name: signerName, signer_cpf: signerCpf, signer_cpf_masked: maskCpf(signerCpf), signer_ip: signerIp, user_agent: ua, signed_at_utc: signedDocument.signedAtIso, signed_at_br: signedDocument.signedAtBr, document_hash: signedDocument.documentHash, validation_token: validationToken, verification_token: validationToken, verify_url: signedDocument.verifyUrl, contract_id: contract.id, signature_provider: 'Harmonics Internal Signature' };
    const initial = await updateContractWithFallbacks({ supabase, contractId: contract.id, patchPayload: { workspace_id: workspaceId, organization_id: contract.organization_id || precontract?.organization_id || null, event_id: contract.event_id || precontract?.event_id || null, contact_id: contract.contact_id || precontract?.contact_id || null, event_date: contract.event_date || precontract?.event_date || null, event_time: contract.event_time || precontract?.event_time || null, formation: contract.formation || precontract?.formation || null, instruments: contract.instruments || precontract?.instruments || null, client_name: contract.client_name || precontract?.client_name || null, location_name: contract.location_name || precontract?.location_name || null, location_address: contract.location_address || precontract?.location_address || null, total_amount: contract.total_amount ?? precontract?.total_amount ?? null, entry_amount: contract.entry_amount ?? precontract?.entry_amount ?? null, remaining_amount: contract.remaining_amount ?? precontract?.remaining_amount ?? null, status: 'signed', precontract_id: contract.precontract_id, public_token: validationToken, signed_html: signedDocument.signedHtml, document_hash: signedDocument.documentHash, signed_at: signedDocument.signedAtIso, signer_ip: signerIp, user_agent: ua, validation_token: validationToken, verification_token: validationToken, signature_metadata: signatureMetadata, signature_name: signerName, signer_name: signerName, signer_document: signerCpf, raw_payload: { ...(contract.raw_payload || {}), signed_contract_html: signedDocument.signedHtml, contract_html_snapshot: signedDocument.immutableHtml, signature_metadata: signatureMetadata } } });
    const pdfData = await generateAndSaveInternalContractPdf({ supabase, contractId: contract.id, precontractId: contract.precontract_id, workspaceId, html: signedDocument.signedHtml });
    const pdfUrl = asString(pdfData?.pdfUrl);
    if (!pdfUrl) { const e = new Error('Fluxo interno retornou sem pdfUrl.'); e.code='STORAGE_ERROR'; e.stage='STORAGE_ERROR'; e.status=502; throw e; }
    const finalResult = await updateContractWithFallbacks({ supabase, contractId: contract.id, patchPayload: { workspace_id: workspaceId, pdf_url: pdfUrl, signed_pdf_url: pdfUrl, signed_at: signedDocument.signedAtIso, document_hash: signedDocument.documentHash, validation_token: validationToken, verification_token: validationToken } });
    const missingColumns = [...(initial?.missingColumns||[]), ...(finalResult?.missingColumns||[])];
    logInfo('PUBLIC_CONTRACT_SIGN_INTERNAL_HELPER_OK', 'OK', { contractId: contract.id, precontractId: contract.precontract_id, hasHtml, hasPdfUrl: true });
    return { ok: true, pdfUrl, documentHash: signedDocument.documentHash, missingColumns, validationToken, verificationToken: validationToken, signedAt: signedDocument.signedAtIso, contractId: contract.id, precontractId: contract.precontract_id };
  } catch (error) {
    logError('PUBLIC_CONTRACT_SIGN_INTERNAL_HELPER_ERROR', 'ERROR', error, { contractId: contractId || null, precontractId: precontractId || null, hasHtml, hasPdfUrl: false, code: error?.code || null, stage: error?.stage || error?.code || null, message: error?.message || String(error) });
    throw error;
  }
}
