import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Compatibilidade: as variáveis globais WHATSAPP_* / ADMIN_WHATSAPP_PHONE pertencem ao
// workspace original (Harmonics). Para esse workspace o envio segue exatamente o caminho
// legado; para qualquer outro, só o canal do próprio workspace pode ser usado.
// Identificação: LEGACY_ENV_WORKSPACE_ID ou o workspace com key/slug "default".
// Remover quando a Harmonics passar a usar apenas o canal cadastrado no banco.

let cachedLegacyWorkspaceId;

async function resolveLegacyEnvWorkspaceId() {
  const configured = String(process.env.LEGACY_ENV_WORKSPACE_ID || '').trim();
  if (configured) return configured;
  if (cachedLegacyWorkspaceId !== undefined) return cachedLegacyWorkspaceId;

  try {
    const { data } = await getSupabaseAdmin()
      .from('workspaces')
      .select('id')
      .or('key.eq.default,slug.eq.default')
      .limit(1)
      .maybeSingle();
    cachedLegacyWorkspaceId = data?.id ? String(data.id) : null;
  } catch {
    return null;
  }

  return cachedLegacyWorkspaceId;
}

export async function isLegacyEnvWorkspace(workspaceId) {
  const id = String(workspaceId || '').trim();
  if (!id) return false;
  return id === (await resolveLegacyEnvWorkspaceId());
}

export async function resolveWorkspaceIdFromEvent(eventId) {
  const id = String(eventId || '').trim();
  if (!id) return null;
  const { data } = await getSupabaseAdmin().from('events').select('workspace_id').eq('id', id).maybeSingle();
  return data?.workspace_id ? String(data.workspace_id) : null;
}
