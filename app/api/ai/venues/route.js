import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { parseVenueInput } from '@/lib/ai/commercial/venues.mjs';

export const dynamic = 'force-dynamic';

// Memória de espaços (Central → Espaços). Só administradores do workspace.
export async function GET(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][VENUES]' });
  if (!guard.ok) return guard.response;
  const ws = guard.auth.workspaceId;
  const [{ data, error }, { data: areas }] = await Promise.all([
    guard.supabase.from('ai_venues').select('*').eq('workspace_id', ws).order('status').order('name'),
    guard.supabase.from('ai_service_areas').select('id, name, active').eq('workspace_id', ws).order('name'),
  ]);
  if (error) return NextResponse.json({ ok: false, error: 'Memória de espaços indisponível (migration pendente?).' }, { status: 503 });
  return NextResponse.json({ ok: true, venues: data || [], areas: areas || [] });
}

// Criar ou atualizar (com id). Status "verified" grava data e responsável da verificação.
export async function POST(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][VENUES][POST]' });
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => ({}));
  const input = parseVenueInput(body, { actor: guard.auth.userId || null });
  if (input.error) return NextResponse.json({ ok: false, error: input.error }, { status: 400 });
  const ws = guard.auth.workspaceId;
  if (input.area_id) {
    const { data: area } = await guard.supabase.from('ai_service_areas').select('id').eq('id', input.area_id).eq('workspace_id', ws).maybeSingle();
    if (!area) return NextResponse.json({ ok: false, error: 'Localidade inválida.' }, { status: 400 });
  }
  const row = { ...input, workspace_id: ws, updated_at: new Date().toISOString() };
  const q = body.id
    ? guard.supabase.from('ai_venues').update(row).eq('id', body.id).eq('workspace_id', ws)
    : guard.supabase.from('ai_venues').insert(row);
  const { data, error } = await q.select('*').maybeSingle();
  if (error) {
    const dup = /duplicate|unique/i.test(error.message || '') || error.code === '23505';
    return NextResponse.json({ ok: false, error: dup ? 'Já existe esse espaço nessa cidade/UF.' : 'Falha ao salvar.' }, { status: dup ? 409 : 500 });
  }
  if (!data) return NextResponse.json({ ok: false, error: 'Espaço não encontrado.' }, { status: 404 });
  return NextResponse.json({ ok: true, venue: data });
}
