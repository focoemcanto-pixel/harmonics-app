export async function deleteScalesCascade({ supabase, eventIds = [] }) {
  const uniqueIds = Array.from(new Set(eventIds.map((id) => String(id || '').trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { requested: 0, success: [], failed: [], deleted: 0, affected: 0, deletedEventIds: [] };
  }

  const { data: eventsFound, error: eventsError } = await supabase
    .from('events')
    .select('id')
    .in('id', uniqueIds);

  if (eventsError) throw eventsError;

  const foundIds = new Set((eventsFound || []).map((item) => String(item.id)));
  const missingIds = uniqueIds.filter((eventId) => !foundIds.has(String(eventId)));

  let musiciansBeforeDelete = [];
  let invitesBeforeDelete = [];
  if (foundIds.size > 0) {
    const { data: musiciansData, error: musiciansCountError } = await supabase
      .from('event_musicians')
      .select('id, event_id')
      .in('event_id', Array.from(foundIds));

    if (musiciansCountError) throw musiciansCountError;
    musiciansBeforeDelete = musiciansData || [];

    const { data: invitesData, error: invitesCountError } = await supabase
      .from('invites')
      .select('id, event_id')
      .in('event_id', Array.from(foundIds));

    if (invitesCountError) throw invitesCountError;
    invitesBeforeDelete = invitesData || [];
  }

  let deletedInvitesRows = [];
  let deletedMusiciansRows = [];
  if (foundIds.size > 0) {
    const { data: deletedInvitesData, error: invitesDeleteError } = await supabase
      .from('invites')
      .delete()
      .in('event_id', Array.from(foundIds))
      .select('id, event_id');

    if (invitesDeleteError) throw invitesDeleteError;
    deletedInvitesRows = deletedInvitesData || [];

    const { data: deletedMusiciansData, error: musiciansDeleteError } = await supabase
      .from('event_musicians')
      .delete()
      .in('event_id', Array.from(foundIds))
      .select('id, event_id');

    if (musiciansDeleteError) throw musiciansDeleteError;
    deletedMusiciansRows = deletedMusiciansData || [];
  }

  const countByEvent = (rows = []) =>
    rows.reduce((acc, row) => {
      const key = String(row.event_id);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

  const musiciansByEvent = countByEvent(musiciansBeforeDelete);
  const invitesByEvent = countByEvent(invitesBeforeDelete);

  const deletedCountByEvent = countByEvent([
    ...deletedInvitesRows,
    ...deletedMusiciansRows,
  ]);

  const success = Array.from(foundIds)
    .filter((eventId) => (deletedCountByEvent[eventId] || 0) > 0)
    .map((eventId) => ({
      eventId,
      deletedEventMusicians: musiciansByEvent[eventId] || 0,
      deletedInvites: invitesByEvent[eventId] || 0,
    }));

  const foundButUntouched = Array.from(foundIds)
    .filter((eventId) => (deletedCountByEvent[eventId] || 0) === 0)
    .map((eventId) => ({
      eventId,
      error: 'Nenhuma escala correspondente foi encontrada para exclusão.',
    }));
  const failed = [
    ...missingIds.map((eventId) => ({ eventId, error: 'Evento não encontrado.' })),
    ...foundButUntouched,
  ];

  return {
    requested: uniqueIds.length,
    success,
    failed,
    deleted: success.length,
    affected: deletedInvitesRows.length + deletedMusiciansRows.length,
    deletedEventIds: success.map((item) => item.eventId),
  };
}
