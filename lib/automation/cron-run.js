import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getDefaultWorkspace } from '@/lib/automation/get-workspace';

const TABLE_NAME = 'automation_cron_runs';

export async function getLatestAutomationCronRun(workspaceId) {
  const supabaseAdmin = getSupabaseAdmin();

  let query = supabaseAdmin
    .from(TABLE_NAME)
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1);

  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function recordAutomationCronRun(payload) {
  const supabaseAdmin = getSupabaseAdmin();
  const workspace = payload?.workspace_id
    ? { id: payload.workspace_id }
    : await getDefaultWorkspace();

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
    throw error;
  }

  return data;
}
