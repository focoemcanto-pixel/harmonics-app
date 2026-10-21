import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  lookupRevision,
  publicRevision,
  signRevision,
} from "@/lib/contracts/revisions";
import { checkRateLimit } from "@/lib/api/rate-limit";
export const dynamic = "force-dynamic";
export async function GET(request, context) {
  return handle(request, context, false);
}
export async function POST(request, context) {
  return handle(request, context, true);
}
async function handle(request, context, sign) {
  try {
    const { token } = await context.params;
    if (!/^[a-f0-9]{32}$/.test(token))
      return NextResponse.json(
        { ok: false, message: "Link inválido." },
        { status: 404 },
      );
    const supabase = getSupabaseAdmin();
    const revision = await lookupRevision(supabase, token);
    if (!revision || revision.status === "cancelled")
      return NextResponse.json(
        { ok: false, message: "Revisão indisponível." },
        { status: 404 },
      );
    let data;
    if (sign) {
      const limit = checkRateLimit({
        key: `revision-sign:${token}`,
        limit: 8,
        windowMs: 15 * 60 * 1000,
      });
      if (!limit.ok)
        return NextResponse.json(
          { ok: false, message: "Aguarde antes de tentar novamente." },
          { status: 429 },
        );
      data = await signRevision({
        supabase,
        revision,
        form: await request.json(),
        headers: request.headers,
      });
    } else data = publicRevision(revision);
    return NextResponse.json(
      { ok: true, ...data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e.message },
      { status: 400 },
    );
  }
}
