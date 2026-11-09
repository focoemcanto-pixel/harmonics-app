import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { isWorkspaceOwner } from '@/lib/ai/commercial/owner.mjs';
import { decideVocalistRequest } from '@/lib/ai/commercial/vocalists.mjs';

export const dynamic = 'force-dynamic';

// Decisão EXPLÍCITA do Owner sobre consulta/convite a vocalista. Aprovar cria (ou reaproveita) o convite do
// Harmonics SEM disparo; o envio continua manual pelo módulo de Convites.
export async function POST(request, { params }) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][VOCALISTS][DECIDE]' });
  if (!guard.ok) return guard.response;
  if (!isWorkspaceOwner(guard.auth)) return NextResponse.json({ ok: false, error: 'Somente o Owner aprova convites de vocalistas.' }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!['approve', 'reject'].includes(body?.decision)) return NextResponse.json({ ok: false, error: 'Decisão inválida.' }, { status: 400 });
  if (body.decision === 'approve' && body.confirm !== true) return NextResponse.json({ ok: false, error: 'Confirmação explícita obrigatória.' }, { status: 400 });
  const ws = guard.auth.workspaceId;
  const { data: settings } = await guard.supabase.from('ai_workspace_settings').select('arrival_minutes, schedule_buffer_minutes').eq('workspace_id', ws).maybeSingle();
  const result = await decideVocalistRequest({
    supabase: guard.supabase, workspaceId: ws, requestId: id, actor: guard.auth.userId, decision: body.decision,
    overrideConflict: body.override_conflict === true, note: typeof body.note === 'string' ? body.note.slice(0, 300) : null, settings: settings || {},
  });
  const status = result.ok ? 200 : { not_found: 404, already_decided: 409, conflict: 409, changed: 409, cancelled: 409, invite_failed: 500 }[result.status] || 400;
  return NextResponse.json(result, { status });
}
