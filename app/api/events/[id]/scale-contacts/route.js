import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireScheduleManagerAccess } from '@/lib/api/require-schedule-manager-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request, context) {
  const supabase = getSupabaseAdmin();
  try {
    const auth = await requireScheduleManagerAccess({
      supabase,
      request,
      logPrefix: '[EVENT_SCALE_CONTACTS_API]',
    });
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error || 'Acesso não autorizado.' }, { status: auth.status || 401 });
    }

    const params = await context?.params;
    const eventId = String(params?.id || '').trim();
    if (!eventId) return NextResponse.json({ ok: false, error: 'Evento inválido.' }, { status: 400 });

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, workspace_id')
      .eq('id', eventId)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event?.id || String(event.workspace_id || '') !== String(auth.workspaceId || '')) {
      return NextResponse.json({ ok: false, error: 'Evento não encontrado neste workspace.' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('contacts')
      .select('id, workspace_id, name, email, phone, tag, notes, contact_type, is_active')
      .eq('workspace_id', auth.workspaceId)
      .neq('contact_type', 'client')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) throw error;

    return NextResponse.json({ ok: true, data: data || [], workspaceId: auth.workspaceId });
  } catch (error) {
    console.error('[EVENT_SCALE_CONTACTS_API][ERROR]', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Não foi possível carregar os membros disponíveis.' }, { status: 500 });
  }
}
