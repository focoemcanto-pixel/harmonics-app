import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getDefaultWorkspaceSettings } from '@/lib/automation/get-workspace';
import { requireAdmin } from '@/lib/api/require-admin';

export async function GET(request) {
  const supabase = getSupabaseAdmin();
  const auth = await requireAdmin({ supabase, request, logPrefix: '[AUTOMATION_ADMIN_CONTACT][GET]' });
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });

  const workspace = await getDefaultWorkspaceSettings(supabase);
  const { data, error } = await supabase.from('workspace_settings').select('id, admin_whatsapp_phone').eq('id', workspace.id).single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, admin: { whatsapp_phone: data?.admin_whatsapp_phone || '' } });
}

export async function PATCH(request) {
  const supabase = getSupabaseAdmin();
  const auth = await requireAdmin({ supabase, request, logPrefix: '[AUTOMATION_ADMIN_CONTACT][PATCH]' });
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });

  const body = await request.json();
  const workspace = await getDefaultWorkspaceSettings(supabase);
  const whatsapp_phone = String(body?.whatsapp_phone || '').trim();

  const { error } = await supabase.from('workspace_settings').update({ admin_whatsapp_phone: whatsapp_phone || null }).eq('id', workspace.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, admin: { whatsapp_phone } });
}
