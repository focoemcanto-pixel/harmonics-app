import { NextResponse } from 'next/server';
import { getDefaultWorkspaceSettings } from '@/lib/automation/get-workspace';
import { getActiveRules } from '@/lib/automation/get-active-rules';
import { getScheduledCandidates } from '@/lib/automation/get-scheduled-candidates';
import { runScheduledAutomation } from '@/lib/automation/run-scheduled-automation';
import { recordAutomationCronRun } from '@/lib/automation/cron-run';

const SCHEDULED_EVENT_TYPES = [
  'repertoire_pending_15_days_client',
  'payment_pending_2_days_client',
  'post_event_review_request_client',
  'schedule_pending_15_days_admin',
];

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    const querySecret = new URL(request.url).searchParams.get('secret');
    const token = authHeader?.replace('Bearer ', '') || querySecret;

    if (token !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('[CRON] Iniciando automações por data...');
  const startedAt = new Date();
  let workspaceId = null;

  try {
    const workspace = await getDefaultWorkspaceSettings();
    workspaceId = workspace.id;

    let totalRules = 0;
    let totalEligible = 0;
    let totalExecutions = 0;
    let totalSent = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    const rulesSummary = [];

    for (const eventType of SCHEDULED_EVENT_TYPES) {
      const rules = await getActiveRules(workspaceId, eventType);

      if (!rules.length) {
        console.log(`[CRON] Nenhuma regra ativa para ${eventType}`);
        continue;
      }

      totalRules += rules.length;

      for (const rule of rules) {
        if (rule.days_before == null && rule.days_after == null) {
          console.log(`[CRON] Regra "${rule.name}" (${rule.id}) sem timing por data — pulando`);
          continue;
        }

        const candidates = await getScheduledCandidates(eventType, rule);

        if (!candidates.length) {
          rulesSummary.push({
            eventType,
            ruleId: rule.id,
            ruleName: rule.name,
            eligible: 0,
            sent: 0,
            skipped: 0,
            failed: 0,
          });
          continue;
        }

        totalEligible += candidates.length;
        const result = await runScheduledAutomation(eventType, candidates, workspaceId);

        totalExecutions += result.executions?.length || 0;
        totalSent += result.sent;
        totalSkipped += result.skipped;
        totalFailed += result.failed;

        rulesSummary.push({
          eventType,
          ruleId: rule.id,
          ruleName: rule.name,
          eligible: candidates.length,
          sent: result.sent,
          skipped: result.skipped,
          failed: result.failed,
        });
      }
    }

    const completedAt = new Date();

    const summary = {
      ok: true,
      timestamp: completedAt.toISOString(),
      totalRules,
      totalEligible,
      totalExecutions,
      totalSent,
      totalSkipped,
      totalFailed,
      rules: rulesSummary,
    };

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

    return NextResponse.json(summary);
  } catch (error) {
    console.error('[CRON] Erro geral:', error);

    try {
      await recordAutomationCronRun({
        workspace_id: workspaceId,
        started_at: startedAt.toISOString(),
        completed_at: new Date().toISOString(),
        status: 'failed',
        total_rules: 0,
        total_eligible: 0,
        total_executions: 0,
        total_sent: 0,
        total_skipped: 0,
        total_failed: 0,
        error_message: error?.message || 'Erro interno',
      });
    } catch (recordError) {
      console.error('[CRON] Falha ao registrar execução do cron:', recordError);
    }

    return NextResponse.json({ error: error?.message || 'Erro interno' }, { status: 500 });
  }
}
