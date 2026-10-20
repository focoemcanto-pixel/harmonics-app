import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireWorkspaceAccess } from "@/lib/api/require-workspace-access";
import { requireMemberAgendaAccess } from "@/lib/api/require-schedule-manager-access";
import { getServiceSpecs } from "@/lib/contracts/service-specs.mjs";
export async function GET(request, context) {
  try {
    const supabase = getSupabaseAdmin();
    let auth = await requireWorkspaceAccess({ supabase, request });
    if (!auth.ok) auth = await requireMemberAgendaAccess({ supabase, request });
    if (!auth.ok)
      return NextResponse.json(
        { ok: false, message: auth.error },
        { status: auth.status || 401 },
      );
    const { id } = await context.params;
    const event = await supabase
      .from("events")
      .select(
        "id,workspace_id,formation,instruments,duration_min,reception_hours,reception_formation,reception_instruments",
      )
      .eq("id", id)
      .eq("workspace_id", auth.workspaceId)
      .maybeSingle();
    if (event.error) throw event.error;
    if (!event.data) return NextResponse.json({ ok: false }, { status: 404 });
    const pre = await supabase
      .from("precontracts")
      .select("service_specs")
      .eq("event_id", id)
      .eq("workspace_id", auth.workspaceId)
      .maybeSingle();
    if (pre.error) throw pre.error;
    return NextResponse.json(
      {
        ok: true,
        service_specs: getServiceSpecs({
          ...event.data,
          service_specs: pre.data?.service_specs ?? null,
        }),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e.message },
      { status: 400 },
    );
  }
}
