import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import { loadWorkspaceCostDefaults, loadWorkspaceSoundTechRules, workspaceSettingsSlug } from '@/lib/settings/workspace-pricing';

export const dynamic = 'force-dynamic';

// Custos padrão do financeiro (custos internos): só Owner, Admin e Financeiro, sempre pelo servidor.
// A tabela finance_cost_defaults não tem política de acesso para o navegador.
const ROLES = ['owner', 'admin', 'administrador', 'financeiro'];
const FIELDS = 'id, slug, musician_unit_cost, sound_default_cost, transport_default_cost, other_default_cost, custom_costs, notes';
const NUMERIC = ['musician_unit_cost', 'sound_default_cost', 'transport_default_cost', 'other_default_cost'];

async function access(request) {
  const supabase = getSupabaseAdmin();
  const auth = await requireWorkspaceAccess({ supabase, request, allowedRoles: ROLES, logPrefix: '[FINANCE_COSTS]' });
  return { supabase, auth };
}

export async function GET(request) {
  const { supabase, auth } = await access(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
  const [{ data, error }, tech] = await Promise.all([
    loadWorkspaceCostDefaults({ supabase, workspaceId: auth.workspaceId, select: FIELDS }),
    loadWorkspaceSoundTechRules({ supabase, workspaceId: auth.workspaceId }),
  ]);
  if (error) return NextResponse.json({ ok: false, error: 'Não foi possível carregar os custos padrão.' }, { status: 500 });
  // sound_tech_rules: custo interno do técnico por duração (mesmos perfis autorizados).
  return NextResponse.json({ ok: true, costs: data || null, sound_tech_rules: tech?.error ? [] : tech?.data || [] });
}

export async function PUT(request) {
  const { supabase, auth } = await access(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
  const body = await request.json().catch(() => ({}));
  const src = body?.costs && typeof body.costs === 'object' ? body.costs : {};
  const payload = { updated_at: new Date().toISOString() };
  for (const k of NUMERIC) {
    if (src[k] === undefined) continue;
    const n = Number(src[k]);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return NextResponse.json({ ok: false, error: `Valor inválido em ${k}.` }, { status: 400 });
    payload[k] = n;
  }
  if (src.custom_costs !== undefined) {
    if (!Array.isArray(src.custom_costs) || src.custom_costs.length > 50) return NextResponse.json({ ok: false, error: 'Custos adicionais inválidos.' }, { status: 400 });
    payload.custom_costs = src.custom_costs;
  }
  if (src.notes !== undefined) payload.notes = String(src.notes || '').slice(0, 2000) || null;
  const { data: existing, error: readError } = await loadWorkspaceCostDefaults({ supabase, workspaceId: auth.workspaceId, select: 'id' });
  if (readError) return NextResponse.json({ ok: false, error: 'Não foi possível salvar os custos padrão.' }, { status: 500 });
  const res = existing?.id
    ? await supabase.from('finance_cost_defaults').update(payload).eq('id', existing.id).eq('workspace_id', auth.workspaceId).select(FIELDS).single()
    : await supabase.from('finance_cost_defaults').insert({ ...payload, workspace_id: auth.workspaceId, slug: workspaceSettingsSlug(auth.workspaceId) }).select(FIELDS).single();
  if (res.error) return NextResponse.json({ ok: false, error: 'Não foi possível salvar os custos padrão.' }, { status: 500 });
  return NextResponse.json({ ok: true, costs: res.data });
}
