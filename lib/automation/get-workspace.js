import { getSupabaseAdmin } from '../supabase-admin';
import { getCurrentWorkspace } from '@/lib/workspaces/get-current-workspace';

const DEFAULT_WORKSPACE_SETTINGS = Object.freeze({
  id: null,
  workspace_id: null,
  workspace_settings_id: null,
  admin_whatsapp_phone: null,
  ai_enabled: false,
  ai_provider: null,
  ai_api_key: null,
  ai_model: null,
  ai_fallback_only: false,
  ai_monthly_limit: null,
  whatsapp: {},
  templates: [],
  rules: [],
  channels: {},
  ai: { enabled: false },
});

const SETTINGS_SELECT =
  'id, workspace_id, admin_whatsapp_phone, ai_enabled, ai_provider, ai_api_key, ai_model, ai_fallback_only, ai_monthly_limit, is_active';
const SETTINGS_SELECT_LEGACY =
  'id, admin_whatsapp_phone, ai_enabled, ai_provider, ai_api_key, ai_model, ai_fallback_only, ai_monthly_limit, is_active';

function normalizeWorkspaceSettings(data) {
  const explicitWorkspaceId = String(data?.workspaceId || '').trim() || null;
  const explicitWorkspaceSettingsId = String(data?.workspaceSettingsId || '').trim() || null;
  const workspaceSettingsId = explicitWorkspaceSettingsId || String(data?.id || '').trim() || null;
  const realWorkspaceId = explicitWorkspaceId || String(data?.workspace_id || '').trim() || null;
  const resolvedWorkspaceId = realWorkspaceId || workspaceSettingsId || null;
  const migrationMode = data?.migrationMode === undefined ? !resolvedWorkspaceId : Boolean(data.migrationMode);

  return {
    ...DEFAULT_WORKSPACE_SETTINGS,
    ...(data || {}),
    // IMPORTANTE:
    // Depois da normalização multi-tenant, as tabelas automation_rules,
    // message_templates, whatsapp_channels e automation_logs usam
    // workspace_id -> public.workspaces.id.
    // Portanto, `id` precisa representar o workspace real para manter
    // compatibilidade com chamadas antigas como getActiveRules(workspace.id).
    id: resolvedWorkspaceId,
    workspaceId: resolvedWorkspaceId,
    workspace_id: resolvedWorkspaceId,
    workspaceSettingsId: workspaceSettingsId,
    workspace_settings_id: workspaceSettingsId,
    migrationMode,
    ai_enabled: Boolean(data?.ai_enabled),
    ai: {
      enabled: Boolean(data?.ai_enabled),
    },
  };
}

function isMissingColumnError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();

  return (
    code === '42703' ||
    message.includes('does not exist') ||
    message.includes('could not find the') ||
    details.includes('schema cache')
  );
}

async function selectActiveSettings(client) {
  let response = await client
    .from('workspace_settings')
    .select(SETTINGS_SELECT)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (response.error && isMissingColumnError(response.error)) {
    response = await client
      .from('workspace_settings')
      .select(SETTINGS_SELECT_LEGACY)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
  }

  return response;
}

async function findActiveWorkspaceSettingsById(id, client) {
  const settingsId = String(id || '').trim();
  if (!settingsId) return null;

  let response = await client
    .from('workspace_settings')
    .select(SETTINGS_SELECT)
    .eq('workspace_id', settingsId)
    .eq('is_active', true)
    .maybeSingle();

  if (response.error && isMissingColumnError(response.error)) {
    response = await client
      .from('workspace_settings')
      .select(SETTINGS_SELECT_LEGACY)
      .eq('id', settingsId)
      .eq('is_active', true)
      .maybeSingle();
  }

  if (!response.error && response.data) return normalizeWorkspaceSettings(response.data);

  response = await client
    .from('workspace_settings')
    .select(SETTINGS_SELECT_LEGACY)
    .eq('id', settingsId)
    .eq('is_active', true)
    .maybeSingle();

  if (response.error) {
    console.warn('[AUTOMATION_SETTINGS_MISSING] erro ao buscar workspace_settings por id; usando fallback', {
      message: response.error.message,
      workspace_settings_id: settingsId,
    });
    return null;
  }

  return response.data ? normalizeWorkspaceSettings(response.data) : null;
}

/**
 * Resolve o workspace_settings padrão ativo.
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 * @returns {Promise<{id: string | null, workspace_id: string | null, workspace_settings_id: string | null}>}
 */
export async function getDefaultWorkspaceSettings(supabase = null) {
  const client = supabase || getSupabaseAdmin();

  const { data, error } = await selectActiveSettings(client);

  if (error) {
    console.warn('[AUTOMATION_SETTINGS_MISSING] erro ao buscar workspace_settings ativo; usando fallback', {
      message: error.message,
    });
    return normalizeWorkspaceSettings(null);
  }

  if (data) {
    return normalizeWorkspaceSettings(data);
  }

  console.warn('[AUTOMATION_SETTINGS_MISSING] workspace_settings ativo não encontrado; tentando criar default');

  const { data: created, error: createError } = await client
    .from('workspace_settings')
    .insert({
      is_active: true,
      ai_enabled: false,
    })
    .select(SETTINGS_SELECT_LEGACY)
    .maybeSingle();

  if (createError) {
    console.warn('[AUTOMATION_SETTINGS_MISSING] falha ao criar workspace_settings default; usando fallback em memória', {
      message: createError.message,
    });
    return normalizeWorkspaceSettings(null);
  }

  return normalizeWorkspaceSettings(created);
}

/**
 * Resolve o workspace_settings da automação a partir do workspace atual.
 *
 * Em ambiente multi-tenant normalizado, `workspace_id` nas tabelas de
 * automação aponta para public.workspaces.id. Por isso, quando há um
 * workspace atual válido, esta função nunca troca silenciosamente para o
 * primeiro workspace_settings ativo: mesmo sem linha correspondente em
 * workspace_settings, o workspace real continua sendo o escopo correto.
 */
export async function getCurrentAutomationWorkspaceSettings({ supabase = null, request = null } = {}) {
  const client = supabase || getSupabaseAdmin();

  try {
    const currentWorkspace = await getCurrentWorkspace({ supabase: client, request });
    const currentWorkspaceId = String(currentWorkspace?.workspaceId || '').trim() || null;

    if (currentWorkspaceId) {
      const byCurrentWorkspace = await findActiveWorkspaceSettingsById(currentWorkspaceId, client);

      if (byCurrentWorkspace?.workspace_settings_id) {
        return normalizeWorkspaceSettings({
          ...byCurrentWorkspace,
          source: 'current_workspace_settings',
          workspaceId: currentWorkspaceId,
          workspace_id: currentWorkspaceId,
          migrationMode: false,
        });
      }

      console.warn('[AUTOMATION_SETTINGS_MISSING] workspace_settings do workspace atual não encontrado; mantendo workspace atual sem fallback', {
        workspaceId: currentWorkspaceId,
        workspaceSource: currentWorkspace?.source || null,
      });

      return normalizeWorkspaceSettings({
        ...(currentWorkspace?.settings || {}),
        id: null,
        workspaceId: currentWorkspaceId,
        workspace_id: currentWorkspaceId,
        workspaceSettingsId: currentWorkspace?.settings?.id || null,
        workspace_settings_id: currentWorkspace?.settings?.id || null,
        source: 'current_workspace',
        migrationMode: false,
      });
    }
  } catch (error) {
    console.warn('[AUTOMATION_SETTINGS_MISSING] falha ao resolver workspace atual; usando default ativo', {
      message: error?.message,
    });
  }

  const fallback = await getDefaultWorkspaceSettings(client);
  return normalizeWorkspaceSettings({
    ...fallback,
    source: 'default_workspace_settings_fallback',
    migrationMode: !fallback?.id,
  });
}

/**
 * Resolve um workspace real válido para automações.
 * Se candidateId vier preenchido, ele permanece como escopo de workspace_id
 * mesmo quando ainda não existir uma linha correspondente em workspace_settings.
 */
export async function resolveWorkspaceSettings(candidateId, supabase = null) {
  const client = supabase || getSupabaseAdmin();
  const workspaceId = String(candidateId || '').trim() || null;

  if (workspaceId) {
    const data = await findActiveWorkspaceSettingsById(workspaceId, client);

    if (data?.id) {
      return normalizeWorkspaceSettings({
        ...data,
        workspaceId,
        workspace_id: workspaceId,
        migrationMode: false,
      });
    }

    console.warn('[resolveWorkspaceSettings] workspace_settings não encontrado/ativo; mantendo workspace informado sem fallback', {
      informed_workspace_id: workspaceId,
    });

    return normalizeWorkspaceSettings({
      id: null,
      workspaceId,
      workspace_id: workspaceId,
      workspaceSettingsId: null,
      workspace_settings_id: null,
      source: 'candidate_workspace',
      migrationMode: false,
    });
  }

  return getDefaultWorkspaceSettings(client);
}
