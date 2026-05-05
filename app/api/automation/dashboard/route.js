import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentAutomationWorkspaceSettings } from '@/lib/automation/get-workspace';
import { getLatestAutomationCronRun } from '@/lib/automation/cron-run';
import { validateChannelConfig } from '@/lib/whatsapp/channel-config';

function getSaoPauloBounds() {
  const now = new Date();
  const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const offset =
    new Intl.DateTimeFormat('en', {
      timeZone: 'America/Sao_Paulo',
      timeZoneName: 'shortOffset',
    })
      .formatToParts(now)
      .find((p) => p.type === 'timeZoneName')
      ?.value?.replace('GMT', '') || '-03:00';

  return {
    start: `${today}T00:00:00${offset}`,
    end: `${today}T23:59:59${offset}`,
  };
}

export async function GET(request) {
  try {
    const supabase = getSupabaseAdmin();
    const workspace = await getCurrentAutomationWorkspaceSettings({ supabase, request });
    const workspaceId = workspace.id;
    const { start: todayStart, end: todayEnd } = getSaoPauloBounds();

    const templatesQuery = supabase.from('message_templates').select('id, is_active').eq('workspace_id', workspaceId);

    let channelsQuery = supabase
      .from('whatsapp_channels')
      .select('id, is_active, is_default, api_url, api_key, instance_id')
      .eq('workspace_id', workspaceId);

    let rulesQuery = supabase
      .from('automation_rules')
      .select('id, is_active, template_id, channel_id, name')
      .eq('workspace_id', workspaceId);

    let logsTodayQuery = supabase
      .from('automation_logs')
      .select('id, status')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd)
      .eq('workspace_id', workspaceId);

    let failuresQuery = supabase
      .from('automation_logs')
      .select('id, created_at, recipient_number, source, error_message, rule_id')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(5)
      .eq('workspace_id', workspaceId);

    const [templatesRes, channelsRes, rulesRes, logsRes, failuresRes, latestCronRun] = await Promise.all([
      templatesQuery,
      channelsQuery,
      rulesQuery,
      logsTodayQuery,
      failuresQuery,
      getLatestAutomationCronRun(workspaceId),
    ]);

    const templates = templatesRes.data || [];
    const channels = channelsRes.data || [];
    const rules = rulesRes.data || [];
    const logsToday = logsRes.data || [];
    const failures = failuresRes.data || [];

    return NextResponse.json({ ok: true, data: { summary: { total_templates: templates.length, active_templates: templates.filter((t) => t.is_active).length, total_channels: channels.length, active_channels: channels.filter((c) => c.is_active).length, total_rules: rules.length, active_rules: rules.filter((r) => r.is_active).length, total_logs_today: logsToday.length, sent_today: logsToday.filter((l) => l.status === 'sent').length, failed_today: logsToday.filter((l) => l.status === 'failed').length, skipped_today: logsToday.filter((l) => l.status === 'skipped').length, }, system_state: 'ok', alerts: [], recent_failures: failures }, ...{ summary: { total_templates: templates.length, active_templates: templates.filter((t) => t.is_active).length, total_channels: channels.length, active_channels: channels.filter((c) => c.is_active).length, total_rules: rules.length, active_rules: rules.filter((r) => r.is_active).length, total_logs_today: logsToday.length, sent_today: logsToday.filter((l) => l.status === 'sent').length, failed_today: logsToday.filter((l) => l.status === 'failed').length, skipped_today: logsToday.filter((l) => l.status === 'skipped').length, }, alerts: [], recent_failures: failures } });
  } catch (error) {
    console.error('[GET /api/automation/dashboard] Erro:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
