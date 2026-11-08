import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { parseServiceAreaInput } from '@/lib/ai/commercial/admin-input.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][AREAS]' });
  if (!guard.ok) return guard.response;
  const { data } = await guard.supabase.from('ai_service_areas').select('*').eq('workspace_id', guard.auth.workspaceId).order('name');
  return NextResponse.json({ ok: true, areas: data || [] });
}

// Upsert por nome (localidades atendidas, condicionais ou bloqueadas).
export async function POST(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][AREAS][POST]' });
  if (!guard.ok) return guard.response;
  const input = parseServiceAreaInput(await request.json().catch(() => ({})));
  if (input.error) return NextResponse.json({ ok: false, error: input.error }, { status: 400 });
  const { data, error } = await guard.supabase.from('ai_service_areas')
    .upsert({ ...input, workspace_id: guard.auth.workspaceId, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,name' })
    .select('*').maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: 'Falha ao salvar.' }, { status: 500 });
  return NextResponse.json({ ok: true, area: data });
}

export async function DELETE(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][AREAS][DELETE]' });
  if (!guard.ok) return guard.response;
  const id = new URL(request.url).searchParams.get('id');
  const { error } = await guard.supabase.from('ai_service_areas').update({ active: false }).eq('id', id).eq('workspace_id', guard.auth.workspaceId);
  return NextResponse.json({ ok: !error });
}
