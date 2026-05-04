import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import { getCurrentWorkspace } from '@/lib/workspaces/get-current-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function buildInviteKey(eventId, contactId) {
  return `${String(eventId || '').trim()}::${String(contactId || '').trim()}`;
}

export async function GET(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireAdmin({ supabase, request, logPrefix: '[EVENT_MUSICIANS_API]' });
    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.error }, { status: auth.status || 401 });
    }

    const { workspaceId } = await getCurrentWorkspace({ supabase });

    const { data: workspaceEvents, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('event_date', { ascending: true });

    if (eventsError) throw eventsError;

    const events = workspaceEvents || [];
    const eventIds = Array.from(
      new Set(events.map((item) => String(item?.id || '').trim()).filter(Boolean))
    );

    if (eventIds.length === 0) {
      return NextResponse.json({
        ok: true,
        data: [],
        events: [],
        contacts: [],
        counts: { events: 0, eventMusicians: 0, contacts: 0, invites: 0 },
        workspaceId,
      });
    }

    const { data: eventMusicians, error } = await supabase
      .from('event_musicians')
      .select('*')
      .in('event_id', eventIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = eventMusicians || [];
    const musicianIds = Array.from(
      new Set(rows.map((item) => String(item?.musician_id || '').trim()).filter(Boolean))
    );

    let contacts = [];
    if (musicianIds.length > 0) {
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('id, name, email, phone, tag, contact_type, is_active, workspace_id')
        .in('id', musicianIds);

      if (contactsError) throw contactsError;
      contacts = contactsData || [];
    }

    let invitesByEventAndContact = new Map();
    let invitesCount = 0;

    if (rows.length > 0 && musicianIds.length > 0) {
      const { data: invites, error: invitesError } = await supabase
        .from('invites')
        .select('id, event_id, contact_id, status, invite_token, suggested_role_name, whatsapp_sent_at, whatsapp_send_count, whatsapp_last_error, created_at')
        .in('event_id', eventIds)
        .in('contact_id', musicianIds)
        .neq('status', 'removed')
        .order('created_at', { ascending: false });

      if (invitesError) throw invitesError;

      invitesCount = (invites || []).length;
      invitesByEventAndContact = new Map();
      for (const invite of invites || []) {
        const key = buildInviteKey(invite?.event_id, invite?.contact_id);
        if (!key || invitesByEventAndContact.has(key)) continue;
        invitesByEventAndContact.set(key, invite);
      }
    }

    const data = rows.map((item) => {
      const invite = invitesByEventAndContact.get(buildInviteKey(item?.event_id, item?.musician_id)) || null;

      return {
        ...item,
        invite_id: invite?.id || null,
        invite_token: invite?.invite_token || null,
        invite_status: invite?.status || null,
        invite_whatsapp_sent_at: invite?.whatsapp_sent_at || null,
        invite_whatsapp_send_count: invite?.whatsapp_send_count || 0,
        invite_whatsapp_last_error: invite?.whatsapp_last_error || null,
      };
    });

    return NextResponse.json({
      ok: true,
      data,
      events,
      contacts,
      counts: {
        events: events.length,
        eventMusicians: data.length,
        contacts: contacts.length,
        invites: invitesCount,
      },
      workspaceId,
    });
  } catch (error) {
    console.error('[EVENT_MUSICIANS_API][GET][ERROR]', {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });

    return NextResponse.json({
      ok: false,
      message: error?.message || 'Erro ao carregar convites',
    }, { status: 500 });
  }
}
