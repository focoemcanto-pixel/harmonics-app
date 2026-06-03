import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';
import { diffEscala } from '@/lib/escalas/escalas-sync';

function dedupeByMusician(list = []) {
  const map = new Map();

  for (const item of Array.isArray(list) ? list : []) {
    const musicianId = String(item?.musician_id || '').trim();
    if (!musicianId) continue;

    const merged = {
      event_id: item?.event_id || null,
      musician_id: musicianId,
      role: String(item?.role || item?.contact_tag_text || '').trim() || null,
      status: String(item?.status || 'pending').trim().toLowerCase() || 'pending',
      notes: String(item?.notes || '').trim() || null,
      confirmed_at: item?.confirmed_at || null,
    };

    map.set(musicianId, merged);
  }

  return Array.from(map.values());
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

async function updateInviteRoles(supabase, updates = []) {
  const safeUpdates = (Array.isArray(updates) ? updates : [])
    .map((item) => ({
      id: String(item?.id || '').trim(),
      suggested_role_name: item?.suggested_role_name || null,
    }))
    .filter((item) => isUuid(item.id));

  if (safeUpdates.length === 0) return;

  const results = await Promise.all(
    safeUpdates.map((item) =>
      supabase
        .from('invites')
        .update({ suggested_role_name: item.suggested_role_name })
        .eq('id', item.id)
    )
  );

  const firstError = results.find((result) => result?.error)?.error;
  if (firstError) throw firstError;
}

export async function POST(request, context) {
  const supabase = getSupabaseAdmin();
  const routeParams = await context?.params;
  const eventId = String(routeParams?.id || '').trim();

  try {
    const auth = await requireWorkspaceAdmin({ supabase, request, logPrefix: '[EVENT_SCALE_API]' });
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
    }

    if (!isUuid(eventId)) {
      return NextResponse.json({ ok: false, error: 'eventId inválido ou ausente.' }, { status: 400 });
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
      return NextResponse.json({ ok: false, error: 'Evento não pertence ao workspace ativo.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const escalaLocal = Array.isArray(body?.escalaLocal) ? body.escalaLocal : [];
    const escalaLocalDedupe = dedupeByMusician(escalaLocal);

    const { data: escalaAtual, error: escalaAtualError } = await supabase
      .from('event_musicians')
      .select('event_id, musician_id, role, status, notes, confirmed_at')
      .eq('event_id', eventId);

    if (escalaAtualError) throw escalaAtualError;

    const escalaAtualDedupe = dedupeByMusician(escalaAtual || []);
    const { removidos } = diffEscala(escalaAtualDedupe, escalaLocalDedupe);

    const payload = escalaLocalDedupe.map((item) => ({
      event_id: eventId,
      musician_id: item.musician_id,
      role: item.role,
      status: item.status || 'pending',
      notes: item.notes,
      confirmed_at:
        item.status === 'confirmed' ? item.confirmed_at || new Date().toISOString() : null,
    }));

    const { error: deleteError } = await supabase
      .from('event_musicians')
      .delete()
      .eq('event_id', eventId);
    if (deleteError) throw deleteError;

    if (payload.length > 0) {
      const { error: insertError } = await supabase.from('event_musicians').insert(payload);
      if (insertError) throw insertError;
    }

    const { data: invitesExistentes, error: invitesError } = await supabase
      .from('invites')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });
    if (invitesError) throw invitesError;

    const invitesByContact = new Map();
    for (const invite of invitesExistentes || []) {
      const key = String(invite?.contact_id || '');
      if (!key) continue;
      if (!invitesByContact.has(key)) invitesByContact.set(key, []);
      invitesByContact.get(key).push(invite);
    }

    const inviteMap = new Map();
    const duplicateInviteIds = [];
    for (const [contactId, rows] of invitesByContact.entries()) {
      if (!Array.isArray(rows) || rows.length === 0) continue;
      inviteMap.set(contactId, rows[0]);
      rows.slice(1).forEach((row) => {
        if (row?.id) duplicateInviteIds.push(row.id);
      });
    }

    if (duplicateInviteIds.length > 0) {
      const { error: dedupeInviteError } = await supabase
        .from('invites')
        .update({ status: 'removed' })
        .eq('event_id', eventId)
        .in('id', duplicateInviteIds);
      if (dedupeInviteError) throw dedupeInviteError;
    }

    const novosParaCriar = [];
    const existentesParaReativar = [];

    for (const item of escalaLocalDedupe) {
      const existing = inviteMap.get(String(item.musician_id));
      if (!existing) {
        novosParaCriar.push(item);
        continue;
      }

      if (String(existing.status || '').toLowerCase() === 'removed') {
        existentesParaReativar.push({
          id: existing.id,
          suggested_role_name: item.role || null,
        });
      }
    }

    if (novosParaCriar.length > 0) {
      const invitesPayload = novosParaCriar.map((item) => ({
        event_id: eventId,
        contact_id: item.musician_id,
        suggested_role_name: item.role || null,
        status: 'pending',
        invite_token:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${item.musician_id}`,
      }));

      const { error: insertInviteError } = await supabase.from('invites').insert(invitesPayload);
      if (insertInviteError) throw insertInviteError;
    }

    if (existentesParaReativar.length > 0) {
      const existingIds = existentesParaReativar.map((item) => item.id).filter(isUuid);
      const { error: reactivateError } = await supabase
        .from('invites')
        .update({
          status: 'pending',
          responded_at: null,
          whatsapp_sent_at: null,
          whatsapp_last_error: null,
        })
        .eq('event_id', eventId)
        .in('id', existingIds);
      if (reactivateError) throw reactivateError;

      await updateInviteRoles(supabase, existentesParaReativar);
    }

    const roleUpdates = [];
    for (const item of escalaLocalDedupe) {
      const existing = inviteMap.get(String(item.musician_id));
      if (!existing) continue;

      const shouldRole = item.role || null;
      if (String(existing.suggested_role_name || '') === String(shouldRole || '')) continue;

      roleUpdates.push({
        id: existing.id,
        suggested_role_name: shouldRole,
      });
    }

    await updateInviteRoles(supabase, roleUpdates);

    const removidosIds = removidos.map((item) => item.musician_id).filter(Boolean);
    if (removidosIds.length > 0) {
      const { error: updateError } = await supabase
        .from('invites')
        .update({ status: 'removed', responded_at: null })
        .eq('event_id', eventId)
        .in('contact_id', removidosIds);
      if (updateError) throw updateError;
    }

    const { data: escalaFinal, error: escalaFinalError } = await supabase
      .from('event_musicians')
      .select('event_id, musician_id, role, status, notes, confirmed_at')
      .eq('event_id', eventId);
    if (escalaFinalError) throw escalaFinalError;

    return NextResponse.json({
      ok: true,
      eventId,
      workspaceId: auth.workspaceId,
      escala: escalaFinal || [],
      stats: {
        total: payload.length,
        novosConvites: novosParaCriar.length,
        removidosConvites: removidosIds.length,
      },
    });
  } catch (error) {
    console.error('[EVENT_SCALE_API][POST][ERROR]', {
      eventId,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Não foi possível salvar a escala do evento.',
      },
      { status: 500 }
    );
  }
}
