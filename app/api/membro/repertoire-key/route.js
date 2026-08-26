import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function createCookieClient(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon || !request?.cookies?.getAll) return null;

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {},
    },
  });
}

async function resolveUser({ supabase, request }) {
  const authHeader = String(request?.headers?.get('authorization') || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    return { user: data?.user || null, error: error || null };
  }

  const cookieClient = createCookieClient(request);
  if (!cookieClient) return { user: null, error: null };
  const { data, error } = await cookieClient.auth.getUser();
  return { user: data?.user || null, error: error || null };
}

function normalizeMusicalKey(value) {
  const raw = String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b');

  if (!raw) return null;
  if (raw.length > 12) throw new Error('Tom inválido. Use algo como B, C, F#, Bb ou Am.');
  if (!/^[A-Ga-g][A-Za-z0-9#b+\-/]*$/.test(raw)) {
    throw new Error('Tom inválido. Use algo como B, C, F#, Bb ou Am.');
  }

  return `${raw.charAt(0).toUpperCase()}${raw.slice(1)}`;
}

async function memberCanEditEvent({ supabase, request, eventId, workspaceId }) {
  const admin = await requireWorkspaceAdmin({
    supabase,
    request,
    logPrefix: '[MEMBER_REPERTOIRE_KEY]',
  });

  if (admin.ok && String(admin.workspaceId || '') === String(workspaceId || '')) {
    return { ok: true, role: 'admin' };
  }

  const { user, error } = await resolveUser({ supabase, request });
  const email = String(user?.email || '').trim().toLowerCase();
  if (error || !user?.id || !email) {
    return { ok: false, status: 401, error: 'Sessão expirada. Faça login novamente.' };
  }

  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('id, workspace_id, email, is_active, can_view_all_events, can_manage_schedules')
    .ilike('email', email)
    .eq('is_active', true)
    .eq('workspace_id', workspaceId)
    .limit(10);

  if (contactsError) throw contactsError;

  const contact = Array.isArray(contacts) ? contacts[0] : null;
  if (!contact?.id) {
    return { ok: false, status: 403, error: 'Seu contato não possui acesso a este evento.' };
  }

  if (contact.can_view_all_events === true || contact.can_manage_schedules === true) {
    return { ok: true, role: 'delegated', contactId: contact.id };
  }

  const [inviteResp, scaleResp] = await Promise.all([
    supabase
      .from('invites')
      .select('id')
      .eq('event_id', eventId)
      .eq('contact_id', contact.id)
      .neq('status', 'removed')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('event_musicians')
      .select('id')
      .eq('event_id', eventId)
      .eq('musician_id', contact.id)
      .limit(1)
      .maybeSingle(),
  ]);

  if (inviteResp.error) throw inviteResp.error;
  if (scaleResp.error) throw scaleResp.error;

  if (inviteResp.data?.id || scaleResp.data?.id) {
    return { ok: true, role: 'member', contactId: contact.id };
  }

  return { ok: false, status: 403, error: 'Você não possui acesso a este repertório.' };
}

export async function PATCH(request) {
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json().catch(() => ({}));
    const itemId = String(body?.itemId || '').trim();
    const musicalKey = normalizeMusicalKey(body?.musicalKey);

    if (!itemId) {
      return NextResponse.json({ ok: false, error: 'Item do repertório não informado.' }, { status: 400 });
    }

    const { data: repertoireItem, error: itemError } = await supabase
      .from('repertoire_items')
      .select('id, event_id')
      .eq('id', itemId)
      .maybeSingle();

    if (itemError) throw itemError;
    if (!repertoireItem?.id || !repertoireItem?.event_id) {
      return NextResponse.json({ ok: false, error: 'Música do repertório não encontrada.' }, { status: 404 });
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, workspace_id')
      .eq('id', repertoireItem.event_id)
      .maybeSingle();

    if (eventError) throw eventError;
    if (!event?.id || !event?.workspace_id) {
      return NextResponse.json({ ok: false, error: 'Evento do repertório não encontrado.' }, { status: 404 });
    }

    const access = await memberCanEditEvent({
      supabase,
      request,
      eventId: event.id,
      workspaceId: event.workspace_id,
    });

    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error }, { status: access.status || 403 });
    }

    const { data: updated, error: updateError } = await supabase
      .from('repertoire_items')
      .update({ musical_key: musicalKey })
      .eq('id', repertoireItem.id)
      .eq('event_id', event.id)
      .select('id, event_id, musical_key')
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      itemId: updated.id,
      eventId: updated.event_id,
      musicalKey: updated.musical_key || '',
      role: access.role,
    });
  } catch (error) {
    console.error('[MEMBER_REPERTOIRE_KEY][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Não foi possível salvar o tom da música.' },
      { status: 500 }
    );
  }
}
