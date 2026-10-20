import {
  resolveContractHtmlSource,
  resolvePrecontractHtmlSource,
} from "./resolveContractHtmlSource";

export function executedBody(contract = {}) {
  const html = String(
    contract.signed_html ||
      contract.raw_payload?.signed_contract_html ||
      contract.raw_payload?.contract_html_snapshot ||
      "",
  );
  return html
    .replace(
      /<section\b[^>]*class=["'][^"']*signature-certificate[^"']*["'][^>]*>[\s\S]*?<\/section>/gi,
      "",
    )
    .trim();
}

// Never infer a signed document's terms from today's shared template or mutable precontract.
export async function resolveSignedContractSource({
  supabase,
  contract,
  precontract,
}) {
  if (contract.status !== "signed") {
    const source = await resolvePrecontractHtmlSource({
      supabase,
      precontract,
    });
    return { html: source.html, mode: "template" };
  }
  const history = await supabase
    .from("contract_revisions")
    .select("source_html")
    .eq("contract_id", contract.id)
    .eq("workspace_id", contract.workspace_id)
    .eq("status", "signed")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (history.error) throw history.error;
  const raw = contract.raw_payload || {};
  const frozen = history.data?.source_html || raw.contract_source_html;
  if (frozen)
    return {
      html: resolveContractHtmlSource({ custom_contract_rich_html: frozen })
        .html,
      mode: "frozen_source",
    };
  const originalPersonalization = resolveContractHtmlSource(
    raw.precontract_snapshot || {},
  );
  if (originalPersonalization.html)
    return { html: originalPersonalization.html, mode: "signing_snapshot" };
  return {
    html: resolveContractHtmlSource({
      custom_contract_rich_html: executedBody(contract),
    }).html,
    mode: "legacy_rendered",
  };
}
