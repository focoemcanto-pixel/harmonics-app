import fs from 'node:fs';

const path = 'lib/automation/execute-automation-event.js';
let source = fs.readFileSync(path, 'utf8');
let changed = false;

if (!source.includes('async function inferAutomationWorkspaceFromEntity')) {
  const marker = `function normalizeId(value) {\n  return String(value || '').trim() || null;\n}\n`;
  if (!source.includes(marker)) {
    throw new Error('[automation workspace patch] normalizeId marker não encontrado');
  }

  const helper = `${marker}\nasync function inferAutomationWorkspaceFromEntity(eventType, entityId) {\n  const supabaseAdmin = getSupabaseAdmin();\n  const safeEntityId = normalizeId(entityId);\n  if (!safeEntityId) return null;\n\n  try {\n    if (eventType === 'invite_member') {\n      const { data } = await supabaseAdmin\n        .from('invites')\n        .select('event:events(workspace_id)')\n        .eq('id', safeEntityId)\n        .maybeSingle();\n      return normalizeId(data?.event?.workspace_id);\n    }\n\n    const eventTypes = new Set([\n      'event_day_confirmation_client',\n      'repertoire_pending_15_days_client',\n      'payment_pending_2_days_client',\n      'post_event_review_request_client',\n      'schedule_pending_15_days_admin',\n    ]);\n\n    if (eventTypes.has(eventType)) {\n      const { data } = await supabaseAdmin\n        .from('events')\n        .select('workspace_id')\n        .eq('id', safeEntityId)\n        .maybeSingle();\n      return normalizeId(data?.workspace_id);\n    }\n\n    const { data: contract } = await supabaseAdmin\n      .from('contracts')\n      .select('event:events(workspace_id)')\n      .eq('id', safeEntityId)\n      .maybeSingle();\n    const contractWorkspaceId = normalizeId(contract?.event?.workspace_id);\n    if (contractWorkspaceId) return contractWorkspaceId;\n\n    const { data: precontract } = await supabaseAdmin\n      .from('precontracts')\n      .select('event_id')\n      .eq('id', safeEntityId)\n      .maybeSingle();\n    const eventId = normalizeId(precontract?.event_id);\n    if (!eventId) return null;\n\n    const { data: event } = await supabaseAdmin\n      .from('events')\n      .select('workspace_id')\n      .eq('id', eventId)\n      .maybeSingle();\n    return normalizeId(event?.workspace_id);\n  } catch (error) {\n    console.warn('[automation][workspace] entity_inference_failed', {\n      eventType,\n      entityId: safeEntityId,\n      error: error?.message || String(error),\n    });\n    return null;\n  }\n}\n`;

  source = source.replace(marker, helper);
  changed = true;
}

const oldBlock = `  const workspaceSettings = await resolveWorkspaceSettings(inputWorkspaceId);\n  const workspaceId = normalizeId(workspaceSettings?.workspace_id || inputWorkspaceId || workspaceSettings?.id);\n  const workspaceSettingsId = normalizeId(workspaceSettings?.id);\n\n  if (!workspaceId) {\n    throw new Error('Workspace real da automação não resolvido.');\n  }`;

if (!source.includes('workspaceInferenceSource')) {
  if (!source.includes(oldBlock)) {
    throw new Error('[automation workspace patch] bloco de resolução esperado não encontrado');
  }

  const newBlock = `  const suppliedWorkspaceId = normalizeId(inputWorkspaceId);\n  const inferredWorkspaceId = suppliedWorkspaceId\n    ? null\n    : await inferAutomationWorkspaceFromEntity(eventType, entityId);\n  const workspaceCandidate = suppliedWorkspaceId || inferredWorkspaceId;\n  const workspaceInferenceSource = suppliedWorkspaceId\n    ? 'caller'\n    : inferredWorkspaceId\n      ? 'entity'\n      : 'unresolved';\n\n  const workspaceSettings = await resolveWorkspaceSettings(workspaceCandidate);\n  const workspaceId = normalizeId(\n    workspaceSettings?.workspace_id || workspaceCandidate || workspaceSettings?.id\n  );\n  const workspaceSettingsId = normalizeId(workspaceSettings?.workspace_settings_id);\n\n  if (!workspaceId) {\n    console.error('[automation][workspace] unresolved', {\n      eventType,\n      entityId,\n      suppliedWorkspaceId,\n      inferredWorkspaceId,\n    });\n    throw new Error('Workspace real da automação não resolvido.');\n  }\n\n  debugAutomationLog('[automation][workspace] resolved', {\n    eventType,\n    entityId,\n    workspaceId,\n    workspaceSettingsId,\n    workspaceInferenceSource,\n  });`;

  source = source.replace(oldBlock, newBlock);
  changed = true;
}

if (changed) fs.writeFileSync(path, source);
console.log(`[automation workspace patch] ${changed ? 'corrigido' : 'já aplicado'}`);
