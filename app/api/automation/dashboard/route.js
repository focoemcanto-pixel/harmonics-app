import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getDefaultWorkspace } from '@/lib/automation/get-workspace';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const workspaceId = await getDefaultWorkspace();

    // Timezone-correct date range for Brazil — derive the real UTC offset dynamically
    const now = new Date();
    const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const tzOffsetPart = new Intl.DateTimeFormat('en', {
      timeZone: 'America/Sao_Paulo',
      timeZoneName: 'shortOffset',
    })
      .formatToParts(now)
      .find((p) => p.type === 'timeZoneName')
      ?.value?.replace('GMT', '') || '-03:00';
    const todayStart = `${today}T00:00:00${tzOffsetPart}`;
    const todayEnd = `${today}T23:59:59${tzOffsetPart}`;

    // ── Templates ────────────────────────────────────────────
    let templatesQuery = supabase
      .from('message_templates')
      .select('id, is_active', { count: 'exact' });
    if (workspaceId) templatesQuery = templatesQuery.eq('workspace_id', workspaceId);
    const { data: templates } = await templatesQuery;

    const totalTemplates = templates?.length ?? 0;
    const activeTemplates = templates?.filter((t) => t.is_active).length ?? 0;

    // ── Channels ─────────────────────────────────────────────
    let channelsQuery = supabase
      .from('whatsapp_channels')
      .select('id, is_active, is_default');
    if (workspaceId) channelsQuery = channelsQuery.eq('workspace_id', workspaceId);
    const { data: channels } = await channelsQuery;

    const totalChannels = channels?.length ?? 0;
    const activeChannels = channels?.filter((c) => c.is_active).length ?? 0;

    // ── Rules ────────────────────────────────────────────────
    let rulesQuery = supabase
      .from('automation_rules')
      .select('id, is_active, template_id, channel_id');
    if (workspaceId) rulesQuery = rulesQuery.eq('workspace_id', workspaceId);
    const { data: rules } = await rulesQuery;

    const totalRules = rules?.length ?? 0;
    const activeRules = rules?.filter((r) => r.is_active).length ?? 0;

    // ── Logs today ───────────────────────────────────────────
    let logsQuery = supabase
      .from('automation_logs')
      .select('id, status')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd);
    if (workspaceId) logsQuery = logsQuery.eq('workspace_id', workspaceId);
    const { data: logsToday } = await logsQuery;

    const totalLogsToday = logsToday?.length ?? 0;
    const sentToday = logsToday?.filter((l) => l.status === 'sent').length ?? 0;
    const failedToday = logsToday?.filter((l) => l.status === 'failed').length ?? 0;
    const skippedToday = logsToday?.filter((l) => l.status === 'skipped').length ?? 0;

    // ── Alerts ───────────────────────────────────────────────
    const alerts = [];

    const defaultChannel = channels?.find((c) => c.is_default);
    if (!defaultChannel) {
      alerts.push({
        type: 'no_default_channel',
        severity: 'critical',
        message: 'Nenhum canal padrão configurado',
      });
    } else if (!defaultChannel.is_active) {
      alerts.push({
        type: 'default_channel_inactive',
        severity: 'critical',
        message: 'Canal padrão está inativo',
      });
    }

    const activeRulesList = rules?.filter((r) => r.is_active) ?? [];

    const rulesWithoutTemplate = activeRulesList.filter((r) => !r.template_id).length;
    if (rulesWithoutTemplate > 0) {
      alerts.push({
        type: 'rules_without_template',
        severity: 'warning',
        count: rulesWithoutTemplate,
        message: `${rulesWithoutTemplate} regra${rulesWithoutTemplate > 1 ? 's ativas sem' : ' ativa sem'} template`,
      });
    }

    const rulesWithoutChannel = activeRulesList.filter((r) => !r.channel_id).length;
    if (rulesWithoutChannel > 0) {
      alerts.push({
        type: 'rules_without_channel',
        severity: 'warning',
        count: rulesWithoutChannel,
        message: `${rulesWithoutChannel} regra${rulesWithoutChannel > 1 ? 's ativas sem' : ' ativa sem'} canal`,
      });
    }

    // Inactive templates referenced by active rules
    const templateIdsUsed = [
      ...new Set(activeRulesList.map((r) => r.template_id).filter(Boolean)),
    ];
    if (templateIdsUsed.length > 0) {
      const inactiveUsedTemplates = templates?.filter(
        (t) => !t.is_active && templateIdsUsed.includes(t.id)
      ).length ?? 0;
      if (inactiveUsedTemplates > 0) {
        alerts.push({
          type: 'inactive_templates_referenced',
          severity: 'warning',
          count: inactiveUsedTemplates,
          message: `${inactiveUsedTemplates} template${inactiveUsedTemplates > 1 ? 's inativos vinculados' : ' inativo vinculado'} a regras ativas`,
        });
      }
    }

    // ── Recent failures ───────────────────────────────────────
    let failuresQuery = supabase
      .from('automation_logs')
      .select('id, created_at, recipient_number, source, error_message, rule_id')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(5);
    if (workspaceId) failuresQuery = failuresQuery.eq('workspace_id', workspaceId);
    const { data: failures } = await failuresQuery;

    // Enrich with rule names
    if (failures && failures.length > 0) {
      const ruleIds = failures.map((f) => f.rule_id).filter(Boolean);
      if (ruleIds.length > 0) {
        const { data: ruleNames } = await supabase
          .from('automation_rules')
          .select('id, name')
          .in('id', ruleIds);
        const ruleMap = Object.fromEntries((ruleNames || []).map((r) => [r.id, r.name]));
        failures.forEach((f) => {
          f.rule_name = f.rule_id ? (ruleMap[f.rule_id] ?? null) : null;
        });
      }
    }

    // ── Last cron run ─────────────────────────────────────────
    const { data: lastRunRow } = await supabase
      .from('automation_meta')
      .select('value')
      .eq('key', 'last_cron_run')
      .maybeSingle();

    const lastCronRun = lastRunRow?.value || null;

    // Alert se cron está parado (> 1 hora)
    if (lastCronRun) {
      const diffSeconds = (Date.now() - new Date(lastCronRun).getTime()) / 1000;
      if (diffSeconds > 3600) {
        alerts.push({
          type: 'cron_stale',
          severity: 'warning',
          message: 'Cron não executou há mais de 1 hora. Verifique se está rodando.',
        });
      }
    }

    return NextResponse.json({
      ok: true,
      summary: {
        total_templates: totalTemplates,
        active_templates: activeTemplates,
        total_channels: totalChannels,
        active_channels: activeChannels,
        total_rules: totalRules,
        active_rules: activeRules,
        total_logs_today: totalLogsToday,
        sent_today: sentToday,
        failed_today: failedToday,
        skipped_today: skippedToday,
      },
      alerts,
      recent_failures: failures || [],
      last_cron_run: lastCronRun,
    });
  } catch (error) {
    console.error('[GET /api/automation/dashboard] Erro:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
