import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { AUTONOMY_MODES } from '@/lib/ai/commercial/supervision.mjs';
import { isWorkspaceOwner, AUTONOMY_CONFIRMATION } from '@/lib/ai/commercial/owner.mjs';

export const dynamic = 'force-dynamic';

function cleanRules(rules = {}) {
  const list = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => String(x).trim()).filter(Boolean).slice(0, 20);
  const out = { allowed_event_types: list(rules.allowed_event_types), allowed_formations: list(rules.allowed_formations) };
  const max = Number(rules.max_total);
  if (Number.isFinite(max) && max > 0) out.max_total = Math.round(max);
  if (rules.allow_reception === false) out.allow_reception = false;
  return out;
}

export async function GET(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][AUTONOMY]' });
  if (!guard.ok) return guard.response;
  const ws = guard.auth.workspaceId;
  const [settings, events] = await Promise.all([
    guard.supabase.from('ai_workspace_settings').select('autonomy_mode, assisted_rules').eq('workspace_id', ws).maybeSingle(),
    guard.supabase.from('ai_autonomy_events').select('from_mode, to_mode, rules, reason, created_at').eq('workspace_id', ws).order('created_at', { ascending: false }).limit(20),
  ]);
  return NextResponse.json({ ok: true, mode: settings.data?.autonomy_mode || 'supervised', rules: settings.data?.assisted_rules || {}, events: events.data || [], is_owner: isWorkspaceOwner(guard.auth) });
}

// Liberar autonomia: somente o Owner, com frase de confirmação. Reduzir para supervisionado: qualquer admin, imediato.
export async function PUT(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][AUTONOMY][PUT]' });
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => ({}));
  const mode = body?.mode;
  if (!AUTONOMY_MODES.includes(mode)) return NextResponse.json({ ok: false, error: 'Modo inválido.' }, { status: 400 });
  const ws = guard.auth.workspaceId;
  const { data: current } = await guard.supabase.from('ai_workspace_settings').select('autonomy_mode').eq('workspace_id', ws).maybeSingle();
  const from = current?.autonomy_mode || 'supervised';
  if (mode !== 'supervised') {
    if (!isWorkspaceOwner(guard.auth)) return NextResponse.json({ ok: false, error: 'Somente o Owner libera autonomia.' }, { status: 403 });
    if (body?.confirm !== AUTONOMY_CONFIRMATION) return NextResponse.json({ ok: false, code: 'CONFIRMATION_REQUIRED', error: `Digite "${AUTONOMY_CONFIRMATION}" para confirmar.` }, { status: 400 });
  }
  const rules = cleanRules(body?.rules);
  const { error } = await guard.supabase.from('ai_workspace_settings')
    .upsert({ workspace_id: ws, autonomy_mode: mode, assisted_rules: rules, updated_by: guard.auth.userId, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' });
  if (error) return NextResponse.json({ ok: false, error: 'Falha ao salvar.' }, { status: 500 });
  await guard.supabase.from('ai_autonomy_events').insert({ workspace_id: ws, from_mode: from, to_mode: mode, rules, actor_user_id: guard.auth.userId, reason: typeof body?.reason === 'string' ? body.reason.slice(0, 300) : null });
  return NextResponse.json({ ok: true, mode, rules });
}
