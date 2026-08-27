import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveWorkspaceSettings } from '@/lib/automation/get-workspace';

const TABLE_NAME = 'automation_cron_runs';

function isMissingCronTable(error) {
  const message = String(error?.message || error?.details || '');
  return error?.code === '42P01' || error?.code === 'PGRST205' || message.includes(TABLE_NAME);
}

export async function getLatestAutomationCronRun(workspaceId) {
  const supabaseAdmin = getSupabaseAdmin();

  let query = supabaseAdmin
    .from(TABLE_NAME)
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1);

  if (workspaceId) query = query.eq('workspace_id', workspaceId);

  const { data, error } = await query.maybeSingle();
  if (error) {
    if (isMissingCronTable(error)) {
      console.warn('[automation cron] tabela de observabilidade ainda não aplicada; seguindo sem histórico.');
      return null;
    }
    throw error;
  }

  return data ?? null;
}

export async function recordAutomationCronRun(payload) {
  const supabaseAdmin = getSupabaseAdmin();
  const workspace = await resolveWorkspaceSettings(payload?.workspace_id);

  const payloadWithWorkspace = {
    ...payload,
    workspace_id: workspace.id,
  };

  const { data, error } = await supabaseAdmin
    .from(TABLE_NAME)
    .insert(payloadWithWorkspace)
    .select()
    .single();

  if (error) {
    if (isMissingCronTable(error)) {
      console.warn('[automation cron] execução concluída sem persistir histórico; migration pendente.');
      return null;
    }
    throw error;
  }

  return data;
}
