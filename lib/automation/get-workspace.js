import { getSupabaseAdmin } from '../supabase-admin';
import { getCurrentWorkspace } from '@/lib/workspaces/get-current-workspace';

const DEFAULT_WORKSPACE_SETTINGS = Object.freeze({
  id: null,
  workspace_id: null,
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
  const resolvedId = String(data?.id || data?.workspace_id || '').trim() || null;

  return {
    ...DEFAULT_WORKSPACE_SETTINGS,
    ...(data || {}),
    id: resolvedId,
    workspace_id: String(data?.workspace_id || resolvedId || '').trim() || null,
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
 * @returns {Promise<{id: string | null}>}
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
 * Compatibilidade de migração:
 * - tenta workspace_settings.workspace_id === current workspaceId;
 * - tenta workspace_settings.id === current workspaceId;
 * - se não existir, mantém o comportamento antigo usando o primeiro ativo.
 */
export async function getCurrentAutomationWorkspaceSettings({ supabase = null, request = null } = {}) {
  const client = supabase || getSupabaseAdmin();

  try {
    const currentWorkspace = await getCurrentWorkspace({ supabase: client, request });
    const byCurrentWorkspace = await findActiveWorkspaceSettingsById(currentWorkspace?.workspaceId, client);

    if (byCurrentWorkspace?.id) {
      return normalizeWorkspaceSettings({
        ...byCurrentWorkspace,
        source: 'current_workspace_settings',
        workspace_id: currentWorkspace.workspaceId,
      });
    }

    console.warn('[AUTOMATION_SETTINGS_MISSING] workspace_settings do workspace atual não encontrado; usando default ativo', {
      workspaceId: currentWorkspace?.workspaceId || null,
    });
  } catch (error) {
    console.warn('[AUTOMATION_SETTINGS_MISSING] falha ao resolver workspace atual; usando default ativo', {
      message: error?.message,
    });
  }

  const fallback = await getDefaultWorkspaceSettings(client);
  return normalizeWorkspaceSettings({
    ...fallback,
    source: 'default_workspace_settings_fallback',
  });
}

/**
 * Resolve um workspace_settings válido para uso em colunas workspace_id.
 * Se candidateId vier inválido/inexistente, cai para o workspace_settings padrão.
 */
export async function resolveWorkspaceSettings(candidateId, supabase = null) {
  const client = supabase || getSupabaseAdmin();

  if (candidateId) {
    const data = await findActiveWorkspaceSettingsById(candidateId, client);

    if (data?.id) {
      return normalizeWorkspaceSettings(data);
    }

    console.warn('[resolveWorkspaceSettings] workspace_settings informado não encontrado/ativo; usando default', {
      informed_workspace_settings_id: candidateId,
    });
  }

  return getDefaultWorkspaceSettings(client);
}
