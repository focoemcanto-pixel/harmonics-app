export async function deleteContactsByIds({ supabase, contactIds = [] }) {
  const uniqueIds = Array.from(new Set(contactIds.map((id) => String(id || '').trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { requested: 0, success: [], failed: [], deleted: 0 };
  }

  const { data: existingRows, error: selectError } = await supabase
    .from('contacts')
    .select('id')
    .in('id', uniqueIds);

  if (selectError) throw selectError;

  const existingIds = new Set((existingRows || []).map((item) => String(item.id)));
  const notFoundIds = uniqueIds.filter((contactId) => !existingIds.has(String(contactId)));

  let deletedRows = [];
  if (existingIds.size > 0) {
    const { data, error } = await supabase
      .from('contacts')
      .delete()
      .in('id', Array.from(existingIds))
      .select('id');

    if (error) throw error;
    deletedRows = data || [];
  }

  const deletedIds = new Set(deletedRows.map((item) => String(item.id)));
  const success = Array.from(deletedIds).map((contactId) => ({ contactId }));
  const failed = [
    ...notFoundIds.map((contactId) => ({ contactId, error: 'Contato não encontrado.' })),
    ...Array.from(existingIds)
      .filter((contactId) => !deletedIds.has(String(contactId)))
      .map((contactId) => ({ contactId, error: 'Erro ao excluir contato.' })),
  ];

  return { requested: uniqueIds.length, success, failed, deleted: success.length };
}
