import { getSupabaseAdmin } from '../supabase-admin';

const DEFAULT_WORKSPACE_SETTINGS = Object.freeze({
  id: null,
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

function normalizeWorkspaceSettings(data) {
  return {
    ...DEFAULT_WORKSPACE_SETTINGS,
    ...(data || {}),
    ai_enabled: Boolean(data?.ai_enabled),
    ai: {
      enabled: Boolean(data?.ai_enabled),
    },
  };
}

/**
 * Resolve o workspace_settings padrão ativo.
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 * @returns {Promise<{id: string | null}>}
 */
export async function getDefaultWorkspaceSettings(supabase = null) {
  const client = supabase || getSupabaseAdmin();

  const { data, error } = await client
    .from('workspace_settings')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

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
    .select('id, admin_whatsapp_phone, ai_enabled, ai_provider, ai_api_key, ai_model, ai_fallback_only, ai_monthly_limit')
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
 * Resolve um workspace_settings válido para uso em colunas workspace_id.
 * Se candidateId vier inválido/inexistente, cai para o workspace_settings padrão.
 */
export async function resolveWorkspaceSettings(candidateId, supabase = null) {
  const client = supabase || getSupabaseAdmin();

  if (candidateId) {
    const { data, error } = await client
      .from('workspace_settings')
      .select('id')
      .eq('id', candidateId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.warn('[AUTOMATION_SETTINGS_MISSING] erro ao validar workspace_settings por id; usando default', {
        message: error.message,
        informed_workspace_settings_id: candidateId,
      });
      return getDefaultWorkspaceSettings(client);
    }

    if (data?.id) {
      return data;
    }

    console.warn('[resolveWorkspaceSettings] workspace_settings informado não encontrado/ativo; usando default', {
      informed_workspace_settings_id: candidateId,
    });
  }

  return getDefaultWorkspaceSettings(client);
}
