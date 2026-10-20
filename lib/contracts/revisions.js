import { buildContractTemplateData } from "./buildContractTemplateData";
import {
  resolvePrecontractHtmlSource,
  resolveContractHtmlSource,
  renderContractHtmlWithTemplateData,
} from "./resolveContractHtmlSource";
import { revisionSnapshot, revisionDiff } from "./revision-model.mjs";
import {
  buildSignedContractHtml,
  extractSignerIp,
  generateHtmlSha256,
} from "./premiumSignature";
import { generatePdfBufferFromHtml } from "./htmlToPdfService";

export async function revisionContext(supabase, contractId, workspaceId) {
  const { data: contract, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .eq("workspace_id", workspaceId)
    .single();
  if (error) throw error;
  const pre = await supabase
    .from("precontracts")
    .select("*")
    .eq("id", contract.precontract_id)
    .eq("workspace_id", workspaceId)
    .single();
  if (pre.error) throw pre.error;
  return { contract, precontract: pre.data };
}
export async function prepareRevision({
  supabase,
  contract,
  precontract,
  changes,
  sourceHtml,
}) {
  const snapshot = revisionSnapshot(precontract, changes);
  const currentSource = await resolvePrecontractHtmlSource({
    supabase,
    precontract,
  });
  const source = resolveContractHtmlSource({
    custom_contract_rich_html: sourceHtml ?? currentSource.html,
  }).html;
  if (!source)
    throw new Error(
      "Contrato sem fonte HTML. Configure o modelo antes de revisar.",
    );
  // Sanitize through the same resolver used for individual templates.
  snapshot.custom_contract_rich_html = source;
  snapshot.custom_contract_content = source;
  const revisionForm = {
    ...(contract.raw_payload?.client_form || {}),
    event_date: snapshot.event_date,
    event_time: snapshot.event_time,
    event_location_name: snapshot.location_name,
    event_location_address: snapshot.location_address,
    accepted_terms: false,
    signed_at: null,
  };
  snapshot.revision_client_form = revisionForm;
  const unsignedContract = {
    ...contract,
    signed_at: null,
    signature_ip: null,
    signature_name: null,
    signature_metadata: null,
    document_hash: null,
    raw_payload: { client_form: revisionForm },
  };
  const data = buildContractTemplateData({
    contract: unsignedContract,
    precontract: snapshot,
    event: null,
    contact: null,
  });
  const html = renderContractHtmlWithTemplateData(source, data);
  if (!html) throw new Error("Revisão sem documento.");
  const diff = revisionDiff(
    { ...precontract, custom_contract_rich_html: currentSource.html },
    snapshot,
  );
  if (
    source !== currentSource.html &&
    !diff.some((d) => d.field === "Cláusulas personalizadas")
  )
    diff.push({
      field: "Cláusulas",
      before: "Texto anterior",
      after: "Texto revisado",
    });
  return { snapshot, source, html, changes: diff };
}
export async function lookupRevision(supabase, token) {
  const { data, error } = await supabase
    .from("contract_revisions")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();
  if (error) throw error;
  return data;
}
export async function lookupSignedRevision(supabase, token) {
  for (const field of ["public_token", "verification_token", "document_hash"]) {
    const { data, error } = await supabase
      .from("contract_revisions")
      .select("*")
      .eq(field, token)
      .eq("status", "signed")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  return null;
}
export function publicRevision(row) {
  return {
    version: row.version,
    status: row.status,
    html: row.status === "signed" ? row.signed_html : row.preview_html,
    content_hash: generateHtmlSha256(row.preview_html),
    changes: row.changes,
    services: row.snapshot.service_specs,
    client_name: row.snapshot.client_name,
    signer_name:
      row.client_form?.signer_name || row.client_form?.full_name || "",
    signer_cpf: row.client_form?.signer_cpf || row.client_form?.cpf || "",
    financial_review_required: row.financial_review_required,
    pdf_url:
      row.status === "signed"
        ? `/api/public/files/contract/${row.public_token}`
        : null,
  };
}
export function validSignerCpf(value) {
  const cpf = String(value || "").replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let n = 9; n < 11; n++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(cpf[i]) * (n + 1 - i);
    const digit = ((sum * 10) % 11) % 10;
    if (digit !== Number(cpf[n])) return false;
  }
  return true;
}
export async function signRevision({ supabase, revision, form, headers }) {
  if (revision.status === "signed") return publicRevision(revision);
  if (revision.status !== "pending")
    throw new Error("Esta revisão não está disponível para assinatura.");
  if (
    form.accepted_terms !== true ||
    !String(form.signer_name || "").trim() ||
    !validSignerCpf(form.signer_cpf)
  )
    throw new Error("Confira nome, CPF válido e aceite dos termos.");
  if (form.content_hash !== generateHtmlSha256(revision.preview_html))
    throw new Error("Conteúdo mudou. Recarregue a revisão antes de assinar.");
  const signed = await buildSignedContractHtml({
    contractHtml: revision.preview_html,
    signerName: form.signer_name.trim(),
    signerCpf: String(form.signer_cpf).replace(/\D/g, ""),
    signedAt: new Date().toISOString(),
    signerIp: extractSignerIp(headers),
    userAgent: headers.get("user-agent"),
    origin: `Revisão ${revision.version}`,
    contractId: revision.contract_id,
    verificationToken: revision.public_token,
  });
  const pdf = await generatePdfBufferFromHtml({
    html: signed.signedHtml,
    contractId: revision.contract_id,
    precontractId: revision.snapshot.id,
  });
  if (!pdf?.length)
    throw new Error("PDF vazio. A versão anterior continua vigente.");
  // A unique attempt path never replaces an earlier signed object, even on retries.
  const path = `workspaces/${revision.workspace_id}/contracts/${revision.contract_id}/revisions/${revision.id}/${crypto.randomUUID()}.pdf`;
  const upload = await supabase.storage
    .from("contract-pdfs")
    .upload(path, pdf, { contentType: "application/pdf", upsert: false });
  if (upload.error) throw upload.error;
  const pdfUrl = supabase.storage.from("contract-pdfs").getPublicUrl(path)
    .data.publicUrl;
  const metadata = {
    signer_name: form.signer_name.trim(),
    signer_cpf: String(form.signer_cpf).replace(/\D/g, ""),
    signed_at_utc: signed.signedAtIso,
    document_hash: signed.documentHash,
    verification_token: revision.public_token,
    validation_token: revision.public_token,
    signer_ip: extractSignerIp(headers),
    user_agent: headers.get("user-agent"),
    version: revision.version,
    accepted_terms: true,
  };
  const { data, error } = await supabase.rpc("complete_contract_revision", {
    p_revision: revision.id,
    p_expected_html: revision.preview_html,
    p_signed_html: signed.signedHtml,
    p_pdf_url: pdfUrl,
    p_hash: signed.documentHash,
    p_metadata: metadata,
  });
  if (error) throw error;
  return publicRevision(data);
}
