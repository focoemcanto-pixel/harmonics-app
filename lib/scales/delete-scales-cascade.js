export async function deleteScalesCascade({ supabase, eventIds = [] }) {
  const uniqueIds = Array.from(new Set(eventIds.map((id) => String(id || '').trim()).filter(Boolean)));
  const success = [];
  const failed = [];

  for (const eventId of uniqueIds) {
    try {
      const { data: eventRow, error: eventError } = await supabase
        .from('events')
        .select('id')
        .eq('id', eventId)
        .maybeSingle();

      if (eventError) throw eventError;
      if (!eventRow?.id) {
        failed.push({ eventId, error: 'Evento não encontrado.' });
        continue;
      }

      const { data: deletedEventMusicians, error: musiciansError } = await supabase
        .from('event_musicians')
        .delete()
        .eq('event_id', eventId)
        .select('id');

      if (musiciansError) throw musiciansError;

      const { data: deletedInvites, error: invitesError } = await supabase
        .from('invites')
        .delete()
        .eq('event_id', eventId)
        .select('id');

      if (invitesError) throw invitesError;

      success.push({
        eventId,
        deletedEventMusicians: (deletedEventMusicians || []).length,
        deletedInvites: (deletedInvites || []).length,
      });
    } catch (error) {
      failed.push({ eventId, error: error?.message || 'Erro ao excluir escala.' });
    }
  }

  return { requested: uniqueIds.length, success, failed };
}
