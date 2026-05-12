export async function trackUsageEvent({
  supabase,
  workspaceId,
  eventType,
  quantity = 1,
  unit = 'count',
  entityType = null,
  entityId = null,
  source = null,
  metadata = {},
  occurredAt = null,
}) {
  try {
    const resolvedWorkspaceId = String(workspaceId || '').trim();
    const resolvedEventType = String(eventType || '').trim();

    if (!supabase || !resolvedWorkspaceId || !resolvedEventType) {
      return { ok: false, skipped: true, reason: 'missing_required_fields' };
    }

    const resolvedQuantity = Number(quantity);

    const { error } = await supabase.from('usage_events').insert({
      workspace_id: resolvedWorkspaceId,
      event_type: resolvedEventType,
      quantity: Number.isFinite(resolvedQuantity) ? resolvedQuantity : 1,
      unit: String(unit || 'count'),
      entity_type: entityType ? String(entityType) : null,
      entity_id: entityId || null,
      source: source ? String(source) : null,
      metadata: metadata || {},
      occurred_at: occurredAt || new Date().toISOString(),
    });

    if (error) {
      console.warn('[USAGE_TRACKING][INSERT_FAILED]', {
        message: error.message,
        code: error.code || null,
        eventType: resolvedEventType,
        workspaceId: resolvedWorkspaceId,
      });
      return { ok: false, error };
    }

    return { ok: true };
  } catch (error) {
    console.warn('[USAGE_TRACKING][SAFE_FAILED]', {
      message: error?.message || String(error),
      eventType,
      workspaceId,
    });
    return { ok: false, error };
  }
}
