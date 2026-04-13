import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getDefaultWorkspaceSettings } from '@/lib/automation/get-workspace';
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

function buildCronStatus(lastRun) {
  if (!lastRun) {
    return {
      status: 'never_run',
      level: 'attention',
      message: 'Cron ainda não executou',
      last_run_at: null,
    };
  }

  const lastRunAt = lastRun.completed_at || lastRun.started_at;
  const ageMs = Date.now() - new Date(lastRunAt).getTime();
  const staleMs = 36 * 60 * 60 * 1000;

  if (lastRun.status === 'failed') {
    return {
      status: 'ran_with_errors',
      level: 'critical',
      message: 'Última execução do cron terminou com erro',
      last_run_at: lastRunAt,
      details: lastRun.error_message || null,
    };
  }

  if (ageMs > staleMs) {
    return {
      status: 'stale',
      level: 'attention',
      message: 'Cron desatualizado (sem execução recente)',
      last_run_at: lastRunAt,
    };
  }

  if ((lastRun.total_failed || 0) > 0) {
    return {
      status: 'ran_with_failures',
      level: 'attention',
      message: 'Cron executou, mas registrou falhas operacionais',
      last_run_at: lastRunAt,
      failed_count: lastRun.total_failed,
    };
  }

  return {
    status: 'healthy',
    level: 'ok',
    message: 'Cron executado recentemente sem falhas críticas',
    last_run_at: lastRunAt,
  };
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const workspace = await getDefaultWorkspaceSettings();
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

    const activeTemplates = templates.filter((t) => t.is_active).length;
    const activeChannels = channels.filter((c) => c.is_active).length;
    const activeRulesList = rules.filter((r) => r.is_active);
    const activeRules = activeRulesList.length;
    const sentToday = logsToday.filter((l) => l.status === 'sent').length;
    const failedToday = logsToday.filter((l) => l.status === 'failed').length;
    const skippedToday = logsToday.filter((l) => l.status === 'skipped').length;

    const alerts = [];
    const defaultChannel = channels.find((c) => c.is_default);
    const defaultChannelReady =
      !!defaultChannel?.is_active &&
      (defaultChannel ? validateChannelConfig(defaultChannel).isValid : false);

    if (!channels.length) {
      alerts.push({
        type: 'no_channels',
        level: 'critical',
        kind: 'configuration',
        message: 'Nenhum canal cadastrado',
        cta: { href: '/automacoes/canais', label: 'Configurar canais' },
      });
    } else if (!defaultChannel) {
      alerts.push({
        type: 'no_default_channel',
        level: 'critical',
        kind: 'configuration',
        message: 'Nenhum canal padrão configurado',
        cta: { href: '/automacoes/canais', label: 'Definir canal padrão' },
      });
    } else if (!defaultChannelReady) {
      alerts.push({
        type: 'default_channel_invalid',
        level: 'critical',
        kind: 'configuration',
        message: 'Canal padrão está inativo ou incompleto para envio',
        cta: { href: '/automacoes/canais', label: 'Corrigir canal padrão' },
      });
    }

    if (!activeTemplates) {
      alerts.push({
        type: 'no_active_templates',
        level: 'attention',
        kind: 'configuration',
        message: 'Nenhum template ativo',
        cta: { href: '/automacoes/templates', label: 'Criar template' },
      });
    }

    if (!activeRules) {
      alerts.push({
        type: 'no_active_rules',
        level: 'attention',
        kind: 'configuration',
        message: 'Nenhuma regra ativa',
        cta: { href: '/automacoes/regras', label: 'Criar regra' },
      });
    }

    const rulesWithoutTemplate = activeRulesList.filter((r) => !r.template_id).length;
    if (rulesWithoutTemplate > 0) {
      alerts.push({
        type: 'rules_without_template',
        level: 'attention',
        kind: 'configuration',
        count: rulesWithoutTemplate,
        message: `${rulesWithoutTemplate} regra(s) ativa(s) sem template vinculado`,
        cta: { href: '/automacoes/regras', label: 'Revisar regras' },
      });
    }

    const rulesWithoutChannel = activeRulesList.filter((r) => !r.channel_id).length;
    if (rulesWithoutChannel > 0) {
      alerts.push({
        type: 'rules_without_channel',
        level: 'attention',
        kind: 'configuration',
        count: rulesWithoutChannel,
        message: `${rulesWithoutChannel} regra(s) ativa(s) sem canal específico (usará padrão)`,
        cta: { href: '/automacoes/regras', label: 'Revisar regras' },
      });
    }

    if (failedToday > 0) {
      alerts.push({
        type: 'failed_dispatches_today',
        level: failedToday > 5 ? 'critical' : 'attention',
        kind: 'operational',
        count: failedToday,
        message: `${failedToday} falha(s) operacional(is) registrada(s) hoje`,
        cta: { href: '/automacoes/logs?status=failed', label: 'Ver falhas' },
      });
    }

    const cronStatus = buildCronStatus(latestCronRun);
    if (cronStatus.level !== 'ok') {
      alerts.push({
        type: 'cron_status',
        level: cronStatus.level,
        kind: 'system',
        message: cronStatus.message,
        cta: { href: '/automacoes/logs', label: 'Analisar logs' },
      });
    }

    const hasOperationalFailure = failures.length > 0 || failedToday > 0;
    const hasCriticalConfigIssue = alerts.some(
      (a) => a.kind === 'configuration' && a.level === 'critical'
    );
    const hasConfigPending = alerts.some((a) => a.kind === 'configuration');

    let systemState = 'healthy';
    if (hasOperationalFailure) {
      systemState = 'operational_failure';
    } else if (hasCriticalConfigIssue) {
      systemState = 'configuration_pending_critical';
    } else if (hasConfigPending) {
      systemState = 'partially_configured';
    } else if ((sentToday + failedToday + skippedToday) === 0) {
      systemState = 'healthy_no_activity';
    }

    if (failures.length > 0) {
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

    return NextResponse.json({
      ok: true,
      summary: {
        total_templates: templates.length,
        active_templates: activeTemplates,
        total_channels: channels.length,
        active_channels: activeChannels,
        total_rules: rules.length,
        active_rules: activeRules,
        total_logs_today: logsToday.length,
        sent_today: sentToday,
        failed_today: failedToday,
        skipped_today: skippedToday,
      },
      system_state: systemState,
      onboarding: {
        has_default_channel: !!defaultChannel,
        default_channel_ready: defaultChannelReady,
        has_active_template: activeTemplates > 0,
        has_active_rule: activeRules > 0,
      },
      cron_status: cronStatus,
      alerts,
      recent_failures: failures,
    });
  } catch (error) {
    console.error('[GET /api/automation/dashboard] Erro:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
