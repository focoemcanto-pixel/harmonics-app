import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeRole(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function extractInviteId(params) {
  if (Array.isArray(params?.inviteId)) return String(params.inviteId[0] || '').trim();
  return String(params?.inviteId || '').trim();
}

function extractBearerToken(request) {
  const authHeader = String(request?.headers?.get('authorization') || '');
  if (!authHeader.startsWith('Bearer ')) return '';
  return authHeader.slice(7).trim();
}

function nowIso() {
  return new Date().toISOString();
}

async function upsertEventMusicianForAccept({ supabase, invite, respondedAt }) {
  const payload = {
    event_id: invite.event_id,
    musician_id: invite.contact_id,
    role: invite.suggested_role_name || null,
    status: 'confirmed',
    confirmed_at: respondedAt,
  };

  const { data, error } = await supabase
    .from('event_musicians')
    .upsert(payload, { onConflict: 'event_id,musician_id' })
    .select('*')
    .maybeSingle();

  if (!error) {
    return data || payload;
  }

  const { data: existing, error: existingError } = await supabase
    .from('event_musicians')
    .select('id')
    .eq('event_id', invite.event_id)
    .eq('musician_id', invite.contact_id)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id) {
    const { data: updated, error: updateError } = await supabase
      .from('event_musicians')
      .update({
        role: invite.suggested_role_name || null,
        status: 'confirmed',
        confirmed_at: respondedAt,
      })
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();

    if (updateError) throw updateError;
    return updated || payload;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('event_musicians')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (insertError) throw insertError;
  return inserted || payload;
}

async function updateEventMusicianForDecline({ supabase, invite }) {
  const { data: existing, error: existingError } = await supabase
    .from('event_musicians')
    .select('id')
    .eq('event_id', invite.event_id)
    .eq('musician_id', invite.contact_id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (!existing?.id) return null;

  const { data, error } = await supabase
    .from('event_musicians')
    .update({
      status: 'declined',
      confirmed_at: null,
    })
    .eq('id', existing.id)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function POST(request, context) {
  const supabase = getSupabaseAdmin();
  const params = await context?.params;
  const inviteId = extractInviteId(params);

  console.info('[MEMBER_INVITE_RESPOND][START]', { inviteId });

  if (!inviteId) {
    return NextResponse.json({ ok: false, error: 'Invite inválido.' }, { status: 400 });
  }

  try {
    const payload = await request.json().catch(() => ({}));
    const action = String(payload?.action || '').trim().toLowerCase();

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({ ok: false, error: 'Ação inválida.' }, { status: 400 });
    }

    const token = extractBearerToken(request);

    if (!token) {
      return NextResponse.json({ ok: false, error: 'Sessão expirada. Faça login novamente.' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData?.user?.id) {
      return NextResponse.json({ ok: false, error: 'Sessão expirada. Faça login novamente.' }, { status: 401 });
    }

    const user = userData.user;
    const userEmail = String(user?.email || '').trim().toLowerCase();

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_admin')
      .eq('id', user.id)
      .maybeSingle();

    const role = normalizeRole(profile?.role);
    const isAdmin = profile?.is_admin === true || role === 'admin' || role === 'administrador';

    let contact = null;

    if (userEmail) {
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('id, email')
        .eq('email', userEmail)
        .maybeSingle();

      if (contactError) {
        throw contactError;
      }

      contact = contactData || null;
    }

    if (!isAdmin && !contact?.id) {
      return NextResponse.json(
        { ok: false, error: 'Contato não encontrado para este usuário.' },
        { status: 403 }
      );
    }

    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('id, event_id, contact_id, suggested_role_name, status')
      .eq('id', inviteId)
      .maybeSingle();

    if (inviteError) {
      throw inviteError;
    }

    console.info('[MEMBER_INVITE_RESPOND][INVITE_FOUND]', {
      inviteId,
      found: Boolean(invite?.id),
      status: invite?.status || null,
    });

    if (!invite?.id) {
      return NextResponse.json({ ok: false, error: 'Convite não encontrado.' }, { status: 404 });
    }

    if (!isAdmin && String(invite.contact_id) !== String(contact.id)) {
      return NextResponse.json({ ok: false, error: 'Sem permissão para responder este convite.' }, { status: 403 });
    }

    const respondedAt = nowIso();
    const nextStatus = action === 'accept' ? 'confirmed' : 'declined';

    const { data: updatedInvite, error: updateInviteError } = await supabase
      .from('invites')
      .update({
        status: nextStatus,
        responded_at: respondedAt,
      })
      .eq('id', invite.id)
      .select('*')
      .maybeSingle();

    if (updateInviteError) {
      throw updateInviteError;
    }

    console.info('[MEMBER_INVITE_RESPOND][INVITE_UPDATED]', {
      inviteId: invite.id,
      status: nextStatus,
      respondedAt,
    });

    let eventMusician = null;

    if (action === 'accept') {
      eventMusician = await upsertEventMusicianForAccept({ supabase, invite, respondedAt });
    } else {
      eventMusician = await updateEventMusicianForDecline({ supabase, invite });
    }

    console.info('[MEMBER_INVITE_RESPOND][EVENT_MUSICIAN_UPSERTED]', {
      inviteId: invite.id,
      eventId: invite.event_id,
      musicianId: invite.contact_id,
      action,
      hasEventMusician: Boolean(eventMusician),
    });

    return NextResponse.json({
      ok: true,
      invite: updatedInvite || {
        ...invite,
        status: nextStatus,
        responded_at: respondedAt,
      },
      eventMusician,
    });
  } catch (error) {
    console.error('[MEMBER_INVITE_RESPOND][ERROR]', {
      inviteId,
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Não foi possível responder o convite.',
      },
      { status: 500 }
    );
  }
}
