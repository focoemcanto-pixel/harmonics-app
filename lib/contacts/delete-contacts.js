export async function deleteContactsByIds({ supabase, contactIds = [] }) {
  const uniqueIds = Array.from(new Set(contactIds.map((id) => String(id || '').trim()).filter(Boolean)));
  const success = [];
  const failed = [];

  for (const contactId of uniqueIds) {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data?.id) {
        failed.push({ contactId, error: 'Contato não encontrado.' });
        continue;
      }

      success.push({ contactId });
    } catch (error) {
      failed.push({ contactId, error: error?.message || 'Erro ao excluir contato.' });
    }
  }

  return { requested: uniqueIds.length, success, failed };
}
