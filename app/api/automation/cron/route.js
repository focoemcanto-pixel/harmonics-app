import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getActiveRules } from '@/lib/automation/get-active-rules';
import { getScheduledCandidates } from '@/lib/automation/get-scheduled-candidates';
import { runScheduledAutomation } from '@/lib/automation/run-scheduled-automation';
import { recordAutomationCronRun } from '@/lib/automation/cron-run';
import { shouldRunScheduledRule } from '@/lib/automation/should-run-scheduled-rule';

const SCHEDULED_EVENT_TYPES = [
  'repertoire_pending_15_days_client',
  'payment_pending_2_days_client',
  'post_event_review_request_client',
  'schedule_pending_15_days_admin',
  'event_day_confirmation_client',
];

async function getWorkspaceIdsWithAutomationRules() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('automation_rules')
    .select('workspace_id')
    .eq('is_active', true)
    .not('workspace_id', 'is', null);
  if (error) throw error;
  return Array.from(new Set((data || []).map((row) => String(row?.workspace_id || '').trim()).filter(Boolean)));
}

async function runCronForWorkspace(workspaceId, startedAt) {
  let totalRules = 0;
  let totalEligible = 0;
  let totalExecutions = 0;
  let totalSent = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  const rulesSummary = [];

  for (const eventType of SCHEDULED_EVENT_TYPES) {
    const rules = await getActiveRules(workspaceId, eventType);
    if (!rules.length) continue;
    totalRules += rules.length;

    for (const rule of rules) {
      const hasPostEventDelay = eventType === 'post_event_review_request_client' && rule.delay_hours != null;
      const hasEventDaySmartSchedule = eventType === 'event_day_confirmation_client';
      if (rule.days_before == null && rule.days_after == null && !hasPostEventDelay && !hasEventDaySmartSchedule) {
        rulesSummary.push({ eventType, ruleId: rule.id, ruleName: rule.name, timing: 'missing', eligible: 0, sent: 0, skipped: 0, failed: 0 });
        continue;
      }

      if (!shouldRunScheduledRule(eventType, rule)) {
        rulesSummary.push({ eventType, ruleId: rule.id, ruleName: rule.name, timing: 'waiting', sendTime: rule.send_time || null, eligible: 0, sent: 0, skipped: 0, failed: 0 });
        continue;
      }

      const candidates = await getScheduledCandidates(eventType, rule);
      if (!candidates.length) {
        rulesSummary.push({ eventType, ruleId: rule.id, ruleName: rule.name, timing: 'ready', eligible: 0, sent: 0, skipped: 0, failed: 0 });
        continue;
      }

      totalEligible += candidates.length;
      const result = await runScheduledAutomation(eventType, candidates, workspaceId);
      totalExecutions += result.executions?.length || 0;
      totalSent += result.sent;
      totalSkipped += result.skipped;
      totalFailed += result.failed;
      rulesSummary.push({ eventType, ruleId: rule.id, ruleName: rule.name, timing: 'ready', eligible: candidates.length, sent: result.sent, skipped: result.skipped, failed: result.failed });
    }
  }

  const completedAt = new Date();
  const summary = { ok: totalFailed === 0, workspaceId, timestamp: completedAt.toISOString(), totalRules, totalEligible, totalExecutions, totalSent, totalSkipped, totalFailed, rules: rulesSummary };

  await recordAutomationCronRun({
    workspace_id: workspaceId,
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
    status: totalFailed > 0 ? 'completed_with_failures' : 'completed',
    total_rules: totalRules,
    total_eligible: totalEligible,
    total_executions: totalExecutions,
    total_sent: totalSent,
    total_skipped: totalSkipped,
    total_failed: totalFailed,
    payload: summary,
  });

  return summary;
}

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    const querySecret = new URL(request.url).searchParams.get('secret');
    const token = authHeader?.replace('Bearer ', '') || querySecret;
    if (token !== cronSecret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = new Date();
  try {
    const workspaceIds = await getWorkspaceIdsWithAutomationRules();
    if (workspaceIds.length === 0) {
      return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), workspacesProcessed: 0, totalRules: 0, totalEligible: 0, totalExecutions: 0, totalSent: 0, totalSkipped: 0, totalFailed: 0, workspaces: [] });
    }

    const workspaceSummaries = [];
    for (const workspaceId of workspaceIds) {
      try {
        workspaceSummaries.push(await runCronForWorkspace(workspaceId, startedAt));
      } catch (workspaceError) {
        console.error(`[CRON][${workspaceId}] Erro no workspace:`, workspaceError);
        await recordAutomationCronRun({ workspace_id: workspaceId, started_at: startedAt.toISOString(), completed_at: new Date().toISOString(), status: 'failed', total_rules: 0, total_eligible: 0, total_executions: 0, total_sent: 0, total_skipped: 0, total_failed: 1, error_message: workspaceError?.message || 'Erro interno' });
        workspaceSummaries.push({ ok: false, workspaceId, error: workspaceError?.message || 'Erro interno', totalRules: 0, totalEligible: 0, totalExecutions: 0, totalSent: 0, totalSkipped: 0, totalFailed: 1, rules: [] });
      }
    }

    const totals = workspaceSummaries.reduce((acc, item) => ({
      totalRules: acc.totalRules + (item.totalRules || 0),
      totalEligible: acc.totalEligible + (item.totalEligible || 0),
      totalExecutions: acc.totalExecutions + (item.totalExecutions || 0),
      totalSent: acc.totalSent + (item.totalSent || 0),
      totalSkipped: acc.totalSkipped + (item.totalSkipped || 0),
      totalFailed: acc.totalFailed + (item.totalFailed || 0),
    }), { totalRules: 0, totalEligible: 0, totalExecutions: 0, totalSent: 0, totalSkipped: 0, totalFailed: 0 });

    return NextResponse.json({ ok: workspaceSummaries.every((item) => item.ok !== false), timestamp: new Date().toISOString(), workspacesProcessed: workspaceSummaries.length, ...totals, workspaces: workspaceSummaries });
  } catch (error) {
    console.error('[CRON] Erro geral:', error);
    return NextResponse.json({ error: error?.message || 'Erro interno' }, { status: 500 });
  }
}
