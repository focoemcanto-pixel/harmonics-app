import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireWorkspaceAccess } from "@/lib/api/require-workspace-access";
export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const integer = (n) => Number.isSafeInteger(n) && n >= 0 && n <= 100000000000;
async function access(request) {
  const db = getSupabaseAdmin();
  const auth = await requireWorkspaceAccess({
    supabase: db,
    request,
    allowedRoles: ["owner", "admin", "administrador", "financeiro"],
  });
  if (!auth.ok)
    throw Object.assign(new Error(auth.error), { status: auth.status });
  // Require actual active tenant membership even for legacy profile administrators.
  if (
    !auth.member ||
    !["owner", "admin", "administrador", "financeiro"].includes(auth.role)
  )
    throw Object.assign(
      new Error("Sem permissão financeira neste workspace."),
      { status: 403 },
    );
  return { db, auth };
}
async function rows(db, table, fields, w) {
  const out = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await db
      .from(table)
      .select(fields)
      .eq("workspace_id", w)
      .order(
        table === "op_finance_defaults"
          ? "key"
          : table === "op_finance_events"
            ? "event_id"
            : table === "op_finance_settings"
              ? "workspace_id"
              : "id",
      )
      .range(start, start + 499);
    if (error) throw error;
    out.push(...data);
    if (data.length < 500) return out;
  }
}
function fail(error) {
  return NextResponse.json(
    { ok: false, message: error.message || "Falha no financeiro operacional." },
    { status: error.status || 400 },
  );
}
export async function GET(request) {
  try {
    const { db, auth } = await access(request);
    const w = auth.workspaceId;
    const [events, sheets, ledger, defaults, settings, contacts] =
      await Promise.all([
        rows(
          db,
          "events",
          "id,client_name,event_date,location_name,formation,agreed_amount,status,has_sound,has_transport,event_time,instruments,has_reception,reception_hours,reception_formation,reception_instruments,has_antesala,antesala_enabled,antesala_included,antesala_duration_minutes,antesala_package,antesala_request_status",
          w,
        ),
        rows(db, "op_finance_events", "*", w),
        rows(db, "op_finance_ledger", "*", w),
        rows(db, "op_finance_defaults", "*", w),
        rows(db, "op_finance_settings", "*", w),
        rows(db, "contacts", "id,name,full_name", w),
      ]);
    let musicians = [];
    for (let i = 0; i < events.length; i += 100) {
      for (let start = 0; ; start += 500) {
        const { data, error } = await db
          .from("event_musicians")
          .select(
            "id,event_id,musician_id,role,status,is_active,musician_name,snapshot_name",
          )
          .in(
            "event_id",
            events.slice(i, i + 100).map((e) => e.id),
          )
          .order("id")
          .range(start, start + 499);
        if (error) throw error;
        musicians.push(...data);
        if (data.length < 500) break;
      }
    }
    const names = new Map(contacts.map((c) => [c.id, c.name || c.full_name]));
    musicians = musicians
      .filter(
        (m) =>
          m.is_active !== false &&
          !["cancelled", "cancelado", "rejected", "recusado"].includes(
            String(m.status).toLowerCase(),
          ),
      )
      .map((m) => ({
        ...m,
        name:
          names.get(m.musician_id) ||
          m.musician_name ||
          m.snapshot_name ||
          "Músico sem identificação",
      }));
    return NextResponse.json(
      {
        ok: true,
        events,
        sheets,
        ledger,
        defaults,
        settings: settings[0] || null,
        musicians,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request) {
  try {
    const { db, auth } = await access(request);
    const b = await request.json();
    if (!uuid.test(b.request_id || ""))
      throw new Error("Identificador de operação inválido.");
    if (b.event_id && !uuid.test(b.event_id))
      throw new Error("Evento inválido.");
    if (
      !["opening", "event", "default", "movement", "reverse"].includes(b.action)
    )
      throw new Error("Ação inválida.");
    if (
      b.action === "opening" &&
      (!integer(b.opening_cents) || !/^\d{4}-\d{2}-\d{2}$/.test(b.opening_on))
    )
      throw new Error("Marco zero inválido.");
    if (
      b.action === "default" &&
      (!integer(b.amount_cents) ||
        typeof b.key !== "string" ||
        b.key.length > 200)
    )
      throw new Error("Padrão inválido.");
    if (b.action === "event") {
      if (
        !b.event_id ||
        !integer(b.contract_cents) ||
        !["draft", "checked"].includes(b.status) ||
        !Array.isArray(b.costs) ||
        b.costs.length > 150
      )
        throw new Error("Ficha inválida.");
      for (const c of b.costs)
        if (
          !uuid.test(c.id) ||
          !integer(c.amount_cents) ||
          !c.description?.trim() ||
          !["predicted", "confirmed"].includes(c.status) ||
          typeof c.category !== "string" ||
          (c.due_on != null && !/^\d{4}-\d{2}-\d{2}$/.test(c.due_on))
        )
          throw new Error("Custo inválido.");
    }
    if (b.action === "movement") {
      if (
        !integer(b.amount_cents) ||
        b.amount_cents === 0 ||
        !["receipt", "payment", "withdrawal"].includes(b.kind) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(b.occurred_on || "")
      )
        throw new Error("Movimento inválido.");
      if (b.kind === "payment" && !uuid.test(b.cost_id || ""))
        throw new Error("Custo inválido.");
      if (b.proof_reference && !/^https:\/\//.test(b.proof_reference))
        throw new Error("Comprovante deve ser um link HTTPS.");
    }
    const { data, error } = await db.rpc("op_finance_command", {
      w: auth.workspaceId,
      actor: auth.userId,
      request_id: b.request_id,
      command: b,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return fail(error);
  }
}
