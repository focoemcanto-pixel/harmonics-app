import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireScheduleManagerAccess } from '@/lib/api/require-schedule-manager-access';
import { diffEscala } from '@/lib/escalas/escalas-sync';
import { sendInviteService } from '@/lib/whatsapp/send-invite-service';

function dedupeByMusician(list = []) {
  const map = new Map();

  for (const item of Array.isArray(list) ? list : []) {
    const musicianId = String(item?.musician_id || '').trim();
    if (!musicianId) continue;

    const merged = {
      id: item?.id || null,
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

function buildScalePayload({ eventId, item, existing = null }) {
  const incomingStatus = String(item?.status || '').trim().toLowerCase();
  const existingStatus = String(existing?.status || '').trim().toLowerCase();
  const shouldPreserveConfirmed = existingStatus === 'confirmed' && (!incomingStatus || incomingStatus === 'pending');
  const status = shouldPreserveConfirmed ? 'confirmed' : incomingStatus || existingStatus || 'pending';

  return {
    event_id: eventId,
    musician_id: item.musician_id,
    role: item.role || null,
    status,
    notes: item.notes || null,
    confirmed_at:
      status === 'confirmed'
        ? item.confirmed_at || existing?.confirmed_at || new Date().toISOString()
        : null,
  };
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

async function syncEventMusicians({ supabase, eventId, current = [], next = [] }) {
  const currentRows = dedupeByMusician(current);
  const nextRows = dedupeByMusician(next);
  const currentMap = new Map(currentRows.map((item) => [String(item.musician_id), item]));
  const { novos, mantidos, alterados, removidos } = diffEscala(currentRows, nextRows);

  const removedIds = removidos.map((item) => item.musician_id).filter(Boolean);
  if (removedIds.length > 0) {
    const { error } = await supabase
      .from('event_musicians')
      .delete()
      .eq('event_id', eventId)
      .in('musician_id', removedIds);
    if (error) throw error;
  }

  if (novos.length > 0) {
    const insertPayload = novos.map((item) => buildScalePayload({ eventId, item }));
    const { error } = await supabase.from('event_musicians').insert(insertPayload);
    if (error) throw error;
  }

  const updateCandidates = [...alterados.map((item) => item.after), ...mantidos.filter((item) => {
    const previous = currentMap.get(String(item.musician_id));
    return previous && String(previous.status || '') === 'confirmed' && String(item.status || '') !== 'confirmed';
  })];

  const dedupedUpdates = dedupeByMusician(updateCandidates);
  for (const item of dedupedUpdates) {
    const existing = currentMap.get(String(item.musician_id));
    if (!existing) continue;

    const { error } = await supabase
      .from('event_musicians')
      .update(buildScalePayload({ eventId, item, existing }))
      .eq('event_id', eventId)
      .eq('musician_id', item.musician_id);
    if (error) throw error;
  }

  return { novos, mantidos, alterados, removidos };
}

export async function POST(request, context) {
  const supabase = getSupabaseAdmin();
  const routeParams = await context?.params;
  const eventId = String(routeParams?.id || '').trim();

  try {
    const auth = await requireScheduleManagerAccess({ supabase, request, logPrefix: '[EVENT_SCALE_API]' });
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
    const shouldSendInvites = body?.sendInvites === true;
    const escalaLocalDedupe = dedupeByMusician(escalaLocal);

    const { data: escalaAtual, error: escalaAtualError } = await supabase
      .from('event_musicians')
      .select('id, event_id, musician_id, role, status, notes, confirmed_at')
      .eq('event_id', eventId);

    if (escalaAtualError) throw escalaAtualError;

    const { novos, alterados, removidos } = await syncEventMusicians({
      supabase,
      eventId,
      current: escalaAtual || [],
      next: escalaLocalDedupe,
    });

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
          musician_id: item.musician_id,
          status: item.status || 'pending',
          confirmed_at: item.confirmed_at || null,
          suggested_role_name: item.role || null,
        });
      }
    }

    if (novosParaCriar.length > 0) {
      const invitesPayload = novosParaCriar.map((item) => {
        const scaleStatus = String(item?.status || '').trim().toLowerCase();
        const isPreconfirmed = scaleStatus === 'confirmed';
        return {
          event_id: eventId,
          contact_id: item.musician_id,
          suggested_role_name: item.role || null,
          status: isPreconfirmed ? 'confirmed' : 'pending',
          responded_at: isPreconfirmed ? item?.confirmed_at || new Date().toISOString() : null,
          invite_token:
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}-${item.musician_id}`,
        };
      });

      const { error: insertInviteError } = await supabase.from('invites').insert(invitesPayload);
      if (insertInviteError) throw insertInviteError;
    }

    if (existentesParaReativar.length > 0) {
      for (const reactivated of existentesParaReativar) {
        const isPreconfirmed = String(reactivated?.status || '').trim().toLowerCase() === 'confirmed';
        const { error: reactivateError } = await supabase
          .from('invites')
          .update({
            status: isPreconfirmed ? 'confirmed' : 'pending',
            responded_at: isPreconfirmed ? reactivated?.confirmed_at || new Date().toISOString() : null,
            whatsapp_sent_at: null,
            whatsapp_last_error: null,
            // Reativar = novo ciclo de convite: novo convite imediato e um novo lembrete
            // de 5 dias contado a partir desse novo envio.
            sent_at: null,
            reminder_5d_claimed_at: null,
            reminder_5d_sent_at: null,
            reminder_5d_attempts: 0,
            reminder_5d_last_error: null,
          })
          .eq('event_id', eventId)
          .eq('id', reactivated.id);
        if (reactivateError) throw reactivateError;
      }

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

    // A escala é a fonte de verdade para membros pré-confirmados pelo administrador.
    // Se o músico já foi salvo como confirmed na escala, seu invite não pode continuar pending.
    for (const item of escalaLocalDedupe) {
      if (String(item?.status || '').trim().toLowerCase() !== 'confirmed') continue;
      const existingInvite = inviteMap.get(String(item.musician_id));
      if (!existingInvite?.id || String(existingInvite.status || '').toLowerCase() === 'confirmed') continue;

      const { error: confirmInviteError } = await supabase
        .from('invites')
        .update({
          status: 'confirmed',
          responded_at: item?.confirmed_at || new Date().toISOString(),
        })
        .eq('event_id', eventId)
        .eq('id', existingInvite.id);
      if (confirmInviteError) throw confirmInviteError;
    }

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

    // Salvar + enviar acontece no MESMO request. Assim não dependemos de um
    // segundo fetch do navegador, de estado stale nem de uma nova resolução de sessão.
    // A deduplicação continua sendo whatsapp_sent_at: somente pending ainda não enviados.
    const dispatch = { requested: shouldSendInvites, total: 0, successCount: 0, failedCount: 0, results: [], firstError: null };

    if (shouldSendInvites) {
      const { data: pendingInvites, error: pendingInvitesError } = await supabase
        .from('invites')
        .select('id, status, whatsapp_sent_at')
        .eq('event_id', eventId)
        .eq('status', 'pending')
        .is('whatsapp_sent_at', null);
      if (pendingInvitesError) throw pendingInvitesError;

      const queue = (pendingInvites || []).filter((row) => isUuid(row?.id));
      dispatch.total = queue.length;

      for (const invite of queue) {
        const result = await sendInviteService({ inviteId: invite.id, supabaseAdmin: supabase });
        const sent = result?.ok === true && Number(result?.data?.sent || 0) > 0;
        const skipped = result?.ok === true && result?.data?.skipped === true;
        const ok = sent || skipped;
        const error = ok ? null : result?.error || result?.data?.error || result?.data?.cause || result?.data?.warning || 'O convite não foi confirmado pelo provedor.';
        dispatch.results.push({ inviteId: invite.id, ok, sent, skipped, error, response: result?.data || null });
        if (ok) dispatch.successCount += 1;
        else {
          dispatch.failedCount += 1;
          if (!dispatch.firstError) dispatch.firstError = error;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      eventId,
      workspaceId: auth.workspaceId,
      escala: escalaFinal || [],
      dispatch,
      stats: {
        total: escalaLocalDedupe.length,
        novos: novos.length,
        alterados: alterados.length,
        removidos: removidos.length,
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
