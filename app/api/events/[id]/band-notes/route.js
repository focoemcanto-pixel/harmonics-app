import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireScheduleManagerAccess } from '@/lib/api/require-schedule-manager-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

export async function PATCH(request, context) {
  const supabase = getSupabaseAdmin();
  const params = await context?.params;
  const eventId = String(params?.id || '').trim();

  try {
    const auth = await requireScheduleManagerAccess({
      supabase,
      request,
      logPrefix: '[EVENT_BAND_NOTES]',
    });

    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
    }

    if (!isUuid(eventId)) {
      return NextResponse.json({ ok: false, error: 'Evento inválido.' }, { status: 400 });
    }

    const { data: eventRow, error: eventError } = await supabase
      .from('events')
      .select('id, workspace_id')
      .eq('id', eventId)
      .maybeSingle();

    if (eventError) throw eventError;
    if (!eventRow?.id) {
      return NextResponse.json({ ok: false, error: 'Evento não encontrado.' }, { status: 404 });
    }

    if (String(eventRow.workspace_id || '') !== String(auth.workspaceId || '')) {
      return NextResponse.json({ ok: false, error: 'Evento não pertence ao workspace autorizado.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const notes = String(body?.notes || '').trim();
    if (notes.length > 8000) {
      return NextResponse.json({ ok: false, error: 'As instruções podem ter no máximo 8.000 caracteres.' }, { status: 400 });
    }

    const updatedAt = new Date().toISOString();
    const updatedBy = String(
      auth?.contact?.name || auth?.contact?.email || auth?.email || auth?.userId || 'Admin Harmonics'
    ).trim();

    const { data, error } = await supabase
      .from('events')
      .update({
        band_notes: notes || null,
        band_notes_updated_at: updatedAt,
        band_notes_updated_by: updatedBy,
      })
      .eq('id', eventId)
      .eq('workspace_id', auth.workspaceId)
      .select('id, band_notes, band_notes_updated_at, band_notes_updated_by')
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ ok: true, event: data });
  } catch (error) {
    console.error('[EVENT_BAND_NOTES][PATCH][ERROR]', {
      eventId,
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Não foi possível salvar as instruções da banda.' },
      { status: 500 }
    );
  }
}
