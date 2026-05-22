function asString(value) {
  return String(value || '').trim();
}

export const MISSING_EVENT_TYPE_TEMPLATE_MESSAGE = 'Tipo de evento sem template padrão configurado';

export async function resolveEventTypeDefaultTemplateId({ supabase, workspaceId, eventTypeId }) {
  const normalizedEventTypeId = asString(eventTypeId);
  if (!normalizedEventTypeId) return null;

  const query = supabase
    .from('event_types')
    .select('id, workspace_id, default_contract_template_id')
    .eq('id', normalizedEventTypeId)
    .maybeSingle();

  const { data, error } = workspaceId
    ? await query.eq('workspace_id', workspaceId)
    : await query;

  if (error) throw error;
  return asString(data?.default_contract_template_id) || null;
}

export async function ensureInternalPrecontractTemplate({ supabase, workspaceId, payload = {}, existingPrecontract = null }) {
  const nextPayload = { ...payload };
  nextPayload.contract_mode = 'internal';
  nextPayload.custom_contract_enabled = true;

  const currentTemplateId = asString(
    nextPayload.contract_template_id || existingPrecontract?.contract_template_id
  );
  if (currentTemplateId) {
    nextPayload.contract_template_id = currentTemplateId;
    return nextPayload;
  }

  const eventTypeId = asString(nextPayload.event_type_id || existingPrecontract?.event_type_id);
  if (!eventTypeId) {
    const err = new Error(MISSING_EVENT_TYPE_TEMPLATE_MESSAGE);
    err.statusCode = 422;
    throw err;
  }

  const defaultTemplateId = await resolveEventTypeDefaultTemplateId({
    supabase,
    workspaceId,
    eventTypeId,
  });

  if (!defaultTemplateId) {
    const err = new Error(MISSING_EVENT_TYPE_TEMPLATE_MESSAGE);
    err.statusCode = 422;
    throw err;
  }

  nextPayload.contract_template_id = defaultTemplateId;
  return nextPayload;
}
