import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getDefaultWorkspace } from '@/lib/automation/get-workspace';
import { getActiveRules } from '@/lib/automation/get-active-rules';
import { getScheduledCandidates } from '@/lib/automation/get-scheduled-candidates';
import { runScheduledAutomation } from '@/lib/automation/run-scheduled-automation';

/**
 * Tipos de eventos suportados pelo scheduler nesta fase.
 * Estruturado para facilitar expansão futura.
 */
const SCHEDULED_EVENT_TYPES = [
  'repertoire_pending_15_days_client',
  'payment_pending_2_days_client',
  'post_event_review_request_client',
  'schedule_pending_15_days_admin',
];

/**
 * GET /api/automation/cron
 *
 * Rota de cron para automações baseadas em data.
 *
 * Fluxo:
 * 1. Resolve workspace padrão
 * 2. Para cada tipo de evento agendado, busca regras ativas com timing por data
 * 3. Identifica candidatos elegíveis (get-scheduled-candidates)
 * 4. Executa via motor de automação (run-scheduled-automation → executeAutomationEvent)
 * 5. Retorna resumo consolidado
 *
 * Proteção via CRON_SECRET (opcional):
 * - Header: Authorization: Bearer <token>
 * - Query param: ?secret=<token>
 *
 * Cloudflare Cron Triggers (futuro):
 * Configure em wrangler.toml:
 *   [triggers]
 *   crons = ["0 13 * * *"]  # diariamente às 10h horário de Brasília (UTC-3)
 */
export async function GET(request) {
  const supabase = getSupabaseAdmin();

  // Verificar secret se configurado
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

  try {
    const workspaceId = await getDefaultWorkspace();
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 500 });
    }

    let totalRules = 0;
    let totalEligible = 0;
    let totalExecutions = 0;
    let totalSent = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    const rulesSummary = [];

    for (const eventType of SCHEDULED_EVENT_TYPES) {
      // Buscar regras ativas para este tipo de evento
      const rules = await getActiveRules(workspaceId, eventType);

      if (!rules.length) {
        console.log(`[CRON] Nenhuma regra ativa para ${eventType}`);
        continue;
      }

      totalRules += rules.length;

      for (const rule of rules) {
        // Pular regras sem configuração de timing por data
        if (rule.days_before == null && rule.days_after == null) {
          console.log(
            `[CRON] Regra "${rule.name}" (${rule.id}) sem timing por data — pulando`
          );
          continue;
        }

        // Encontrar candidatos elegíveis para hoje
        const candidates = await getScheduledCandidates(eventType, rule);

        if (!candidates.length) {
          console.log(`[CRON] Nenhum candidato para ${eventType} (regra: "${rule.name}")`);
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
        console.log(
          `[CRON] ${candidates.length} candidato(s) para ${eventType} (regra: "${rule.name}")`
        );

        // Executar via motor de automação — o motor é responsável por:
        // resolver template, canal, verificar duplicidade, enviar e logar
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

    const summary = {
      ok: true,
      timestamp: new Date().toISOString(),
      totalRules,
      totalEligible,
      totalExecutions,
      totalSent,
      totalSkipped,
      totalFailed,
      rules: rulesSummary,
    };

    // Registrar última execução do cron
    const now = new Date().toISOString();
    await supabase
      .from('automation_meta')
      .upsert(
        { key: 'last_cron_run', value: now, updated_at: now },
        { onConflict: 'key' }
      );

    console.log('[CRON] Concluído:', JSON.stringify({ ...summary, rules: undefined }));
    return NextResponse.json(summary);
  } catch (error) {
    console.error('[CRON] Erro geral:', error);
    return NextResponse.json({ error: error?.message || 'Erro interno' }, { status: 500 });
  }
}
