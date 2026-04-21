export async function deleteInvitesByIds({ supabase, inviteIds = [] }) {
  const uniqueIds = Array.from(new Set(inviteIds.map((id) => String(id || '').trim()).filter(Boolean)));
  const success = [];
  const failed = [];

  for (const inviteId of uniqueIds) {
    try {
      const { data, error } = await supabase
        .from('event_musicians')
        .delete()
        .eq('id', inviteId)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data?.id) {
        failed.push({ inviteId, error: 'Convite não encontrado.' });
        continue;
      }

      success.push({ inviteId });
    } catch (error) {
      failed.push({ inviteId, error: error?.message || 'Erro ao excluir convite.' });
    }
  }

  return { requested: uniqueIds.length, success, failed };
}
