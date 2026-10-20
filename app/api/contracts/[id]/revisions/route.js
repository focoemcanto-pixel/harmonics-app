import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireWorkspaceAdmin } from "@/lib/api/require-workspace-access";
import { revisionContext, prepareRevision } from "@/lib/contracts/revisions";
import { resolveSignedContractSource } from "@/lib/contracts/signed-source";
export const dynamic = "force-dynamic";
export async function GET(request, context) {
  return handle(request, context, false);
}
export async function POST(request, context) {
  return handle(request, context, true);
}
async function handle(request, context, write) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = await requireWorkspaceAdmin({ supabase, request });
    if (!auth.ok)
      return NextResponse.json(
        { ok: false, message: auth.error },
        { status: auth.status || 401 },
      );
    const { id } = await context.params;
    const { contract, precontract } = await revisionContext(
      supabase,
      id,
      auth.workspaceId,
    );
    const history = await supabase
      .from("contract_revisions")
      .select(
        "id,version,base_version,status,public_token,changes,signed_at,created_at,pdf_url,financial_review_required",
      )
      .eq("contract_id", id)
      .eq("workspace_id", auth.workspaceId)
      .order("version", { ascending: false });
    if (history.error) throw history.error;
    if (!write) {
      const signedSource = await resolveSignedContractSource({
        supabase,
        contract,
        precontract,
      });
      return NextResponse.json(
        {
          ok: true,
          contract,
          precontract,
          source: signedSource.html,
          sourceMode: signedSource.mode,
          history: history.data,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (contract.status !== "signed")
      return NextResponse.json(
        {
          ok: false,
          message:
            "Contrato ainda não está assinado. Edite o pré-contrato normalmente.",
        },
        { status: 409 },
      );
    const body = await request.json();
    if (body.action === "cancel") {
      const { error } = await supabase
        .from("contract_revisions")
        .update({ status: "cancelled" })
        .eq("id", body.revision_id)
        .eq("contract_id", id)
        .eq("workspace_id", auth.workspaceId)
        .eq("status", "pending");
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    const prepared = await prepareRevision({
      supabase,
      contract,
      precontract,
      changes: body.changes || {},
      sourceHtml: body.source_html,
    });
    if (body.action === "preview")
      return NextResponse.json({ ok: true, ...prepared });
    if (
      prepared.sourceMode === "legacy_rendered" &&
      body.legacy_source_ack !== true
    )
      return NextResponse.json(
        {
          ok: false,
          message:
            "Este contrato antigo só possui o texto assinado. Confira e ajuste as cláusulas no editor antes de publicar a revisão.",
        },
        { status: 409 },
      );
    if (!prepared.changes.length)
      return NextResponse.json(
        { ok: false, message: "Nenhuma alteração nesta revisão." },
        { status: 400 },
      );
    if (body.expected_updated_at !== contract.updated_at)
      return NextResponse.json(
        {
          ok: false,
          message: "O contrato mudou. Recarregue antes de revisar.",
        },
        { status: 409 },
      );
    const { data, error } = await supabase.rpc("create_contract_revision", {
      p_contract: id,
      p_workspace: auth.workspaceId,
      p_actor: auth.userId,
      p_snapshot: prepared.snapshot,
      p_source: prepared.source,
      p_html: prepared.html,
      p_changes: prepared.changes,
      p_expected_updated_at: contract.updated_at,
    });
    if (error) throw error;
    return NextResponse.json({
      ok: true,
      revision: data,
      link: `/contrato/revisao/${data.public_token}`,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e.message },
      { status: 400 },
    );
  }
}
