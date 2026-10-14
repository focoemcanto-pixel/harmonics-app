import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Compatibilidade: as variáveis globais WHATSAPP_* / ADMIN_WHATSAPP_PHONE pertencem ao
// workspace original (Harmonics). Para esse workspace o envio segue exatamente o caminho
// legado; para qualquer outro, só o canal do próprio workspace pode ser usado.
// Identificação: o id fixo da Harmonics ou LEGACY_ENV_WORKSPACE_ID. Sem busca por key/slug
// "default": um tenant novo nunca pode herdar as credenciais globais.
// Remover quando a Harmonics passar a usar apenas o canal cadastrado no banco.

// Mesmo id usado em app/api/onboarding/flow-status.
const HARMONICS_WORKSPACE_ID = 'f36dcd9b-22a9-487a-bf2e-691d17bd6294';

export async function isLegacyEnvWorkspace(workspaceId) {
  const id = String(workspaceId || '').trim();
  if (!id) return false;
  if (id === HARMONICS_WORKSPACE_ID) return true;
  const configured = String(process.env.LEGACY_ENV_WORKSPACE_ID || '').trim();
  return Boolean(configured) && id === configured;
}

export async function resolveWorkspaceIdFromEvent(eventId) {
  const id = String(eventId || '').trim();
  if (!id) return null;
  const { data } = await getSupabaseAdmin().from('events').select('workspace_id').eq('id', id).maybeSingle();
  return data?.workspace_id ? String(data.workspace_id) : null;
}
