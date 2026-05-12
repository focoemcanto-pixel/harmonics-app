export function getRequestIp(request) {
  return (
    request?.headers?.get('x-forwarded-for')?.split(',')?.[0]?.trim() ||
    request?.headers?.get('cf-connecting-ip') ||
    request?.headers?.get('x-real-ip') ||
    null
  );
}

export function getRequestUserAgent(request) {
  return request?.headers?.get('user-agent') || null;
}

export async function safeLogFileAccess({
  supabase,
  request,
  workspaceId,
  entityType,
  entityId = null,
  bucketId = null,
  objectPath = null,
  accessType = 'signed_url_generated',
  actorUserId = null,
  actorRole = null,
  expiresInSeconds = null,
  status = 'success',
  errorMessage = null,
  metadata = {},
}) {
  try {
    const resolvedWorkspaceId = String(workspaceId || '').trim();
    if (!resolvedWorkspaceId || !supabase) return;

    const { error } = await supabase.from('file_access_logs').insert({
      workspace_id: resolvedWorkspaceId,
      entity_type: String(entityType || 'file'),
      entity_id: entityId || null,
      bucket_id: bucketId || null,
      object_path: objectPath || null,
      access_type: accessType,
      actor_user_id: actorUserId || null,
      actor_role: actorRole || null,
      ip_address: getRequestIp(request),
      user_agent: getRequestUserAgent(request),
      expires_in_seconds: Number.isFinite(Number(expiresInSeconds)) ? Number(expiresInSeconds) : null,
      status,
      error_message: errorMessage || null,
      metadata: metadata || {},
    });

    if (error) {
      console.warn('[FILE_ACCESS_LOG][INSERT_FAILED]', {
        message: error.message,
        code: error.code || null,
        entityType,
        entityId,
      });
    }
  } catch (error) {
    console.warn('[FILE_ACCESS_LOG][SAFE_FAILED]', {
      message: error?.message || String(error),
      entityType,
      entityId,
    });
  }
}
