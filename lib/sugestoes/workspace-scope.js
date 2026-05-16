export function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}

export function logSuggestionScope(message, details = {}) {
  if (!isDevelopment()) return;
  console.info(message, details);
}

export function isMissingWorkspaceColumnError(error) {
  const message = String(error?.message || error?.details || '').toLowerCase();
  return message.includes('workspace_id') && (message.includes('does not exist') || message.includes('could not find'));
}

export function normalizeWorkspaceId(workspaceId) {
  return String(workspaceId || '').trim() || null;
}

export function migrationRequiredPayload(resource = 'items', workspaceId = null) {
  return {
    ok: true,
    [resource]: [],
    workspaceId,
    migrationRequired: true,
  };
}

export function isScopedToWorkspace(row, workspaceId) {
  const scopedWorkspaceId = normalizeWorkspaceId(workspaceId);
  return Boolean(scopedWorkspaceId && String(row?.workspace_id || '') === scopedWorkspaceId);
}

export function stripCrossWorkspaceRelations(song, workspaceId) {
  const scopedWorkspaceId = normalizeWorkspaceId(workspaceId);
  if (!song || !scopedWorkspaceId) return song;

  const genre = !song.genre || String(song.genre?.workspace_id || '') === scopedWorkspaceId ? song.genre : null;
  const moment = !song.moment || String(song.moment?.workspace_id || '') === scopedWorkspaceId ? song.moment : null;

  return {
    ...song,
    genre,
    moment,
    song_tags: Array.isArray(song.song_tags)
      ? song.song_tags.filter((link) => !link?.tag || String(link.tag?.workspace_id || '') === scopedWorkspaceId)
      : song.song_tags,
    collection_links: Array.isArray(song.collection_links)
      ? song.collection_links.filter((link) => !link?.collection || String(link.collection?.workspace_id || '') === scopedWorkspaceId)
      : song.collection_links,
  };
}

export async function filterExistingWorkspaceIds(supabase, table, ids = [], workspaceId) {
  const scopedWorkspaceId = normalizeWorkspaceId(workspaceId);
  const normalizedIds = Array.from(new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean)));
  if (!scopedWorkspaceId || normalizedIds.length === 0) return [];

  const { data, error } = await supabase
    .from(table)
    .select('id, workspace_id')
    .eq('workspace_id', scopedWorkspaceId)
    .in('id', normalizedIds);

  if (error) throw error;
  return (data || []).map((row) => row.id);
}

export async function assertOptionalForeignKeyInWorkspace(supabase, table, id, workspaceId, label) {
  const normalizedId = String(id || '').trim();
  const scopedWorkspaceId = normalizeWorkspaceId(workspaceId);
  if (!normalizedId) return null;

  const { data, error } = await supabase
    .from(table)
    .select('id, workspace_id')
    .eq('id', normalizedId)
    .eq('workspace_id', scopedWorkspaceId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) {
    const err = new Error(`${label || 'Registro relacionado'} não pertence ao workspace atual.`);
    err.status = 400;
    throw err;
  }
  return normalizedId;
}
