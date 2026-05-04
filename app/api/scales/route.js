import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import { getCurrentWorkspace } from '@/lib/workspaces/get-current-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function uniq(list = []) {
  return Array.from(new Set(list.map((item) => String(item || '').trim()).filter(Boolean)));
}

export async function GET(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireAdmin({ supabase, request, logPrefix: '[SCALES_API]' });
    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.error }, { status: auth.status || 401 });
    }

    const { workspaceId } = await getCurrentWorkspace({ supabase });

    const { data: eventos, error: eventosError } = await supabase
      .from('events')
      .select('id, client_name, event_date, event_time, location_name, formation, instruments, status, created_at')
      .eq('workspace_id', workspaceId)
      .order('event_date', { ascending: true });

    if (eventosError) throw eventosError;

    const eventIds = uniq((eventos || []).map((event) => event?.id));

    if (eventIds.length === 0) {
      return NextResponse.json({
        ok: true,
        eventos: [],
        escalas: [],
        invites: [],
        workspaceId,
        debug: {
          eventosCount: 0,
          escalasCount: 0,
          invitesCount: 0,
        },
      });
    }

    const { data: escalaRows, error: escalaError } = await supabase
      .from('event_musicians')
      .select('id, event_id, musician_id, role, status, notes, confirmed_at, created_at')
      .in('event_id', eventIds)
      .order('created_at', { ascending: true });

    if (escalaError) throw escalaError;

    const musicianIds = uniq((escalaRows || []).map((item) => item?.musician_id));

    let contactsById = new Map();
    if (musicianIds.length > 0) {
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, name, phone, email, tag, category')
        .in('id', musicianIds);

      if (contactsError) throw contactsError;
      contactsById = new Map((contacts || []).map((contact) => [String(contact.id), contact]));
    }

    const escalas = (escalaRows || []).map((item) => ({
      ...item,
      musician: contactsById.get(String(item?.musician_id || '')) || null,
    }));

    const { data: inviteRows, error: invitesError } = await supabase
      .from('invites')
      .select('id, event_id, contact_id, suggested_role_name, status')
      .in('event_id', eventIds)
      .order('id', { ascending: false });

    if (invitesError) throw invitesError;

    const inviteContactIds = uniq((inviteRows || []).map((invite) => invite?.contact_id));
    const inviteEventIds = uniq((inviteRows || []).map((invite) => invite?.event_id));

    let inviteContactsById = new Map();
    if (inviteContactIds.length > 0) {
      const { data: inviteContacts, error: inviteContactsError } = await supabase
        .from('contacts')
        .select('id, name, phone, email')
        .in('id', inviteContactIds);

      if (inviteContactsError) throw inviteContactsError;
      inviteContactsById = new Map((inviteContacts || []).map((contact) => [String(contact.id), contact]));
    }

    const eventsById = new Map((eventos || []).map((event) => [String(event.id), event]));

    const invites = (inviteRows || []).map((invite) => ({
      ...invite,
      event: eventsById.get(String(invite?.event_id || '')) || null,
      contact: inviteContactsById.get(String(invite?.contact_id || '')) || null,
    })).filter((invite) => invite.event && inviteEventIds.includes(String(invite.event_id)));

    return NextResponse.json({
      ok: true,
      eventos: eventos || [],
      escalas,
      invites,
      workspaceId,
      debug: {
        eventosCount: (eventos || []).length,
        escalasCount: escalas.length,
        invitesCount: invites.length,
      },
    });
  } catch (error) {
    console.error('[SCALES_API][GET][ERROR]', {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });

    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'Erro ao carregar escalas.',
      },
      { status: 500 }
    );
  }
}
