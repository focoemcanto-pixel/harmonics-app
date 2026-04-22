function normalizeIds(ids = []) {
  return Array.from(new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean)));
}

async function safeDeleteByEventIds(supabase, table, eventIds = []) {
  if (!eventIds.length) return { table, count: 0, ids: [] };

  const { data, error } = await supabase
    .from(table)
    .delete()
    .in('event_id', eventIds)
    .select('id, event_id');

  if (error) throw error;

  return {
    table,
    count: Array.isArray(data) ? data.length : 0,
    ids: Array.isArray(data) ? data.map((row) => String(row.event_id || '').trim()).filter(Boolean) : [],
  };
}

async function clearRepertoireEventResidues(supabase, eventIds = []) {
  if (!eventIds.length) {
    return { attempted: false, updatedCount: 0, ignored: false };
  }

  const resetPayload = {
    has_antesala: false,
    antesala_enabled: false,
    antesala_requested_by_client: false,
    antesala_request_status: null,
    antesala_price_increment: null,
    antesala_duration_minutes: null,
  };

  try {
    const { data, error } = await supabase
      .from('events')
      .update(resetPayload)
      .in('id', eventIds)
      .select('id');

    if (error) throw error;

    return {
      attempted: true,
      updatedCount: Array.isArray(data) ? data.length : 0,
      ignored: false,
    };
  } catch (error) {
    console.warn('[REPERTOIRE_DELETE][EVENT_RESIDUE_RESET][SKIP]', {
      message: error?.message,
      code: error?.code,
    });

    return {
      attempted: true,
      updatedCount: 0,
      ignored: true,
      reason: error?.message || 'event_residue_reset_failed',
    };
  }
}

export async function deleteRepertoiresCascade({ supabase, eventIds = [] }) {
  const uniqueIds = normalizeIds(eventIds);
  if (uniqueIds.length === 0) {
    return {
      requested: 0,
      affected: 0,
      success: false,
      deletedEventIds: [],
      notFoundEventIds: [],
      breakdown: [],
      message: 'Nenhum repertório correspondente foi encontrado para exclusão.',
    };
  }

  const { data: foundRows, error: foundError } = await supabase
    .from('repertoire_config')
    .select('event_id')
    .in('event_id', uniqueIds);

  if (foundError) throw foundError;

  const foundIds = normalizeIds((foundRows || []).map((row) => row?.event_id));
  const foundSet = new Set(foundIds);
  const notFoundEventIds = uniqueIds.filter((id) => !foundSet.has(id));

  if (foundIds.length === 0) {
    return {
      requested: uniqueIds.length,
      affected: 0,
      success: false,
      deletedEventIds: [],
      notFoundEventIds,
      breakdown: [],
      message: 'Nenhum repertório correspondente foi encontrado para exclusão.',
    };
  }

  const deletedItems = await safeDeleteByEventIds(supabase, 'repertoire_items', foundIds);
  const deletedTokens = await safeDeleteByEventIds(supabase, 'repertoire_tokens', foundIds);
  const deletedConfigs = await safeDeleteByEventIds(supabase, 'repertoire_config', foundIds);
  const eventResiduesCleanup = await clearRepertoireEventResidues(supabase, foundIds);

  const deletedEventIds = normalizeIds(deletedConfigs.ids);
  const affected = Number(deletedItems.count || 0) + Number(deletedTokens.count || 0) + Number(deletedConfigs.count || 0);

  return {
    requested: uniqueIds.length,
    affected,
    success: deletedEventIds.length > 0,
    deletedEventIds,
    notFoundEventIds,
    breakdown: [
      { table: 'repertoire_items', deleted: deletedItems.count },
      { table: 'repertoire_tokens', deleted: deletedTokens.count },
      { table: 'repertoire_config', deleted: deletedConfigs.count },
      { table: 'events(residue_reset)', deleted: eventResiduesCleanup.updatedCount, ignored: eventResiduesCleanup.ignored },
    ],
    message:
      deletedEventIds.length > 0
        ? `${deletedEventIds.length} repertório(s) excluído(s) com sucesso.`
        : 'Nenhum repertório correspondente foi encontrado para exclusão.',
  };
}
