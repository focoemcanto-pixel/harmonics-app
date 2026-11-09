import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { parseMusicianInput } from '@/lib/ai/commercial/admin-input.mjs';

export const dynamic = 'force-dynamic';

// Catálogo comercial dos músicos, ligado aos contatos existentes (sem duplicar cadastro).
export async function GET(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][MUSICIANS]' });
  if (!guard.ok) return guard.response;
  const workspaceId = guard.auth.workspaceId;
  const [profiles, contacts] = await Promise.all([
    guard.supabase.from('ai_musician_profiles').select('*').eq('workspace_id', workspaceId).order('display_name'),
    guard.supabase.from('contacts').select('id, name, tag, contact_type, is_active').eq('workspace_id', workspaceId).order('name').limit(500),
  ]);
  const musicians = (contacts.data || []).filter((c) => c.is_active !== false && !/client|cliente/i.test(String(c.contact_type || '')));
  return NextResponse.json({ ok: true, profiles: profiles.data || [], contacts: musicians });
}

export async function POST(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][MUSICIANS][POST]' });
  if (!guard.ok) return guard.response;
  const input = parseMusicianInput(await request.json().catch(() => ({})));
  if (input.error) return NextResponse.json({ ok: false, error: input.error }, { status: 400 });
  const workspaceId = guard.auth.workspaceId;
  const { data: contact } = await guard.supabase.from('contacts').select('id').eq('id', input.contact_id).eq('workspace_id', workspaceId).maybeSingle();
  if (!contact) return NextResponse.json({ ok: false, error: 'Contato não encontrado.' }, { status: 404 });
  if (input.is_primary_vocal) {
    await guard.supabase.from('ai_musician_profiles').update({ is_primary_vocal: false }).eq('workspace_id', workspaceId).neq('contact_id', input.contact_id);
  }
  const save = (row) => guard.supabase.from('ai_musician_profiles')
    .upsert({ ...row, workspace_id: workspaceId, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,contact_id' })
    .select('*').maybeSingle();
  let { data, error } = await save(input);
  let warning = null;
  // Antes da migração de vocalistas as colunas novas não existem: salva o perfil sem elas e avisa.
  if (error && ['42703', 'PGRST204'].includes(error.code)) {
    const { voice, client_presentable, presentation_urls, ...legacy } = input;
    ({ data, error } = await save(legacy));
    if (!error && (voice || client_presentable || (presentation_urls || []).length)) {
      warning = 'Voz, autorização e links de apresentação ficam disponíveis após a migração de vocalistas.';
    }
  }
  if (error) return NextResponse.json({ ok: false, error: 'Falha ao salvar.' }, { status: 500 });
  return NextResponse.json({ ok: true, profile: data, warning });
}
