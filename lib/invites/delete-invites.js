export async function deleteInvitesByIds({ supabase, inviteIds = [] }) {
  const uniqueIds = Array.from(new Set(inviteIds.map((id) => String(id || '').trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { requested: 0, success: [], failed: [], deleted: 0 };
  }

  const { data: existingRows, error: selectError } = await supabase
    .from('event_musicians')
    .select('id')
    .in('id', uniqueIds);

  if (selectError) {
    throw selectError;
  }

  const existingIds = new Set((existingRows || []).map((item) => String(item.id)));
  const notFoundIds = uniqueIds.filter((inviteId) => !existingIds.has(String(inviteId)));

  let deletedRows = [];
  if (existingIds.size > 0) {
    const { data, error } = await supabase
      .from('event_musicians')
      .delete()
      .in('id', Array.from(existingIds))
      .select('id');

    if (error) throw error;
    deletedRows = data || [];
  }

  const deletedIds = new Set(deletedRows.map((item) => String(item.id)));
  const success = Array.from(deletedIds).map((inviteId) => ({ inviteId }));
  const failed = [
    ...notFoundIds.map((inviteId) => ({ inviteId, error: 'Convite não encontrado.' })),
    ...Array.from(existingIds)
      .filter((inviteId) => !deletedIds.has(String(inviteId)))
      .map((inviteId) => ({ inviteId, error: 'Erro ao excluir convite.' })),
  ];

  return { requested: uniqueIds.length, success, failed, deleted: success.length };
}
