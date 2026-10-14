import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin, guardWorkspaceMember } from '@/lib/api/route-guards';
import { loadWorkspacePricing, workspaceSettingsSlug } from '@/lib/settings/workspace-pricing';

export const dynamic = 'force-dynamic';

// Campos que o cliente nunca controla: identidade e escopo vêm da sessão.
const PROTECTED_FIELDS = new Set(['id', 'slug', 'workspace_id', 'created_at', 'updated_at']);

export async function GET(request) {
  const guard = await guardWorkspaceMember(request, { logPrefix: '[GET /api/settings/pricing]' });
  if (!guard.ok) return guard.response;

  const { data, error } = await loadWorkspacePricing({ supabase: guard.supabase, workspaceId: guard.auth.workspaceId });
  if (error) {
    console.error('[GET /api/settings/pricing][ERROR]', { code: error.code, message: error.message });
    return NextResponse.json({ ok: false, error: 'Não foi possível carregar os preços.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pricing: data || null });
}

export async function PUT(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[PUT /api/settings/pricing]' });
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));
  const source = body?.pricing && typeof body.pricing === 'object' ? body.pricing : {};
  const payload = {};
  for (const [key, value] of Object.entries(source)) {
    if (!PROTECTED_FIELDS.has(key)) payload[key] = value;
  }
  payload.updated_at = new Date().toISOString();

  const supabase = guard.supabase;
  const workspaceId = guard.auth.workspaceId;

  const { data: existing, error: existingError } = await loadWorkspacePricing({ supabase, workspaceId, select: 'id' });
  if (existingError) {
    return NextResponse.json({ ok: false, error: 'Não foi possível salvar os preços.' }, { status: 500 });
  }

  const response = existing?.id
    ? await supabase.from('pricing_settings').update(payload).eq('id', existing.id).eq('workspace_id', workspaceId).select('*').single()
    : await supabase
        .from('pricing_settings')
        .insert({ ...payload, workspace_id: workspaceId, slug: workspaceSettingsSlug(workspaceId) })
        .select('*')
        .single();

  if (response.error) {
    console.error('[PUT /api/settings/pricing][ERROR]', { code: response.error.code, message: response.error.message });
    return NextResponse.json({ ok: false, error: 'Não foi possível salvar os preços.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pricing: response.data });
}
