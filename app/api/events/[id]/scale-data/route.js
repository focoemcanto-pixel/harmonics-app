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
      logPrefix: '[EVENT_SCALE_DATA_API]',
    });
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error || 'Acesso não autorizado.' }, { status: auth.status || 401 });
    }

    const params = await context?.params;
    const eventId = String(params?.id || '').trim();
    if (!eventId) return NextResponse.json({ ok: false, error: 'Evento inválido.' }, { status: 400 });

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, workspace_id, client_name, event_date, event_time, location_name, formation, instruments, status, open_amount, payment_status')
      .eq('id', eventId)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event?.id || String(event.workspace_id || '') !== String(auth.workspaceId || '')) {
      return NextResponse.json({ ok: false, error: 'Evento não encontrado neste workspace.' }, { status: 404 });
    }

    const [contactsRes, scaleRes, templatesRes, templateItemsRes, repertoireRes] = await Promise.all([
      supabase
        .from('contacts')
        .select('id, workspace_id, name, email, phone, tag, tags, role, instrument, instruments, category, notes, contact_type, is_active')
        .eq('workspace_id', auth.workspaceId)
        .neq('contact_type', 'client')
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabase
        .from('event_musicians')
        .select('id, event_id, musician_id, role, status, notes, confirmed_at, created_at, updated_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true }),
      supabase
        .from('scale_templates')
        .select('*')
        .eq('is_active', true),
      supabase
        .from('scale_template_items')
        .select('*')
        .order('sort_order', { ascending: true }),
      supabase
        .from('repertoire_config')
        .select('status')
        .eq('event_id', eventId)
        .order('updated_at', { ascending: false })
        .limit(1),
    ]);

    const firstError = [contactsRes, scaleRes, templatesRes, templateItemsRes, repertoireRes].find((r) => r?.error)?.error;
    if (firstError) throw firstError;

    return NextResponse.json({
      ok: true,
      event,
      contacts: contactsRes.data || [],
      scale: scaleRes.data || [],
      templates: templatesRes.data || [],
      templateItems: templateItemsRes.data || [],
      repertoire: Array.isArray(repertoireRes.data) ? repertoireRes.data[0] || null : null,
    });
  } catch (error) {
    console.error('[EVENT_SCALE_DATA_API][ERROR]', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Não foi possível carregar a montagem da escala.' }, { status: 500 });
  }
}
