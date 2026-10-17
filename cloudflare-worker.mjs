// Entrada do Worker de produção: o handler gerado pelo OpenNext + Cron Trigger da Cloudflare.
// O agendamento roda aqui (confiável) em vez do schedule do GitHub Actions, que atrasava/pulava
// execuções. O cron chama a mesma rota /api/automation/cron, com o mesmo CRON_SECRET (só do env do
// Worker, nunca em URL/query) e a mesma deduplicação de envios.
import handler from './.open-next/worker.js';

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js';

const CRON_URL = 'https://app.bandaharmonics.com/api/automation/cron';

async function runScheduledAutomations(controller, env, ctx) {
  const scheduledTime = new Date(controller.scheduledTime).toISOString();
  const secret = String(env?.CRON_SECRET || '').trim();
  if (!secret) {
    console.error('[CRON][CLOUDFLARE] CRON_SECRET ausente no Worker: execução não realizada', { cron: controller.cron, scheduledTime });
    return;
  }

  const startedAt = Date.now();
  try {
    const response = await handler.fetch(
      new Request(CRON_URL, {
        headers: { authorization: `Bearer ${secret}`, 'x-cron-source': 'cloudflare-cron' },
      }),
      env,
      ctx
    );
    const body = await response.json().catch(() => null);
    const summary = {
      cron: controller.cron,
      scheduledTime,
      status: response.status,
      durationMs: Date.now() - startedAt,
      ok: body?.ok ?? null,
      workspacesProcessed: body?.workspacesProcessed ?? null,
      totalEligible: body?.totalEligible ?? null,
      totalSent: body?.totalSent ?? null,
      totalSkipped: body?.totalSkipped ?? null,
      totalFailed: body?.totalFailed ?? null,
      error: body?.error || null,
    };
    if (response.ok) console.info('[CRON][CLOUDFLARE] concluído', summary);
    else console.error('[CRON][CLOUDFLARE] falhou', summary);
  } catch (error) {
    console.error('[CRON][CLOUDFLARE] erro', { cron: controller.cron, scheduledTime, message: error?.message || String(error) });
  }
}

export default {
  fetch: handler.fetch,
  async scheduled(controller, env, ctx) {
    await runScheduledAutomations(controller, env, ctx);
  },
};
