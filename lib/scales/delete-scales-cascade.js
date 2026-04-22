export async function deleteScalesCascade({ supabase, eventIds = [] }) {
  const uniqueIds = Array.from(new Set(eventIds.map((id) => String(id || '').trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { requested: 0, success: [], failed: [], deleted: 0 };
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

  if (foundIds.size > 0) {
    const { error: invitesDeleteError } = await supabase
      .from('invites')
      .delete()
      .in('event_id', Array.from(foundIds));

    if (invitesDeleteError) throw invitesDeleteError;

    const { error: musiciansDeleteError } = await supabase
      .from('event_musicians')
      .delete()
      .in('event_id', Array.from(foundIds));

    if (musiciansDeleteError) throw musiciansDeleteError;
  }

  const countByEvent = (rows = []) =>
    rows.reduce((acc, row) => {
      const key = String(row.event_id);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

  const musiciansByEvent = countByEvent(musiciansBeforeDelete);
  const invitesByEvent = countByEvent(invitesBeforeDelete);

  const success = Array.from(foundIds).map((eventId) => ({
    eventId,
    deletedEventMusicians: musiciansByEvent[eventId] || 0,
    deletedInvites: invitesByEvent[eventId] || 0,
  }));
  const failed = missingIds.map((eventId) => ({ eventId, error: 'Evento não encontrado.' }));

  return { requested: uniqueIds.length, success, failed, deleted: success.length };
}
