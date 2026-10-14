import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api-observability';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { authenticateAsaasWebhook, processAsaasWebhook } from '@/lib/billing/process-asaas-webhook';

export const dynamic = 'force-dynamic';

// Webhook Asaas: autenticado (asaas-access-token), idempotente (UNIQUE provider+event_id),
// auditável (billing_events) e resistente a eventos fora de ordem (dateCreated).
async function handlePOST(request) {
  const auth = authenticateAsaasWebhook(request.headers);
  if (!auth.ok) {
    console.warn('[BILLING][WEBHOOK][REJECTED]', { status: auth.status });
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 });
  }

  const result = await processAsaasWebhook({ supabase: getSupabaseAdmin(), payload });
  console.info('[BILLING][WEBHOOK]', {
    eventId: payload?.id || null,
    event: payload?.event || null,
    httpStatus: result.httpStatus,
    outcome: result.body?.applied || result.body?.ignored || (result.body?.duplicate ? 'duplicate' : null),
  });
  return NextResponse.json(result.body, { status: result.httpStatus });
}

export const POST = withApiObservability(handlePOST, { route: '/api/webhooks/asaas' });
