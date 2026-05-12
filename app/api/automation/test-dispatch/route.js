import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import { executeAutomationEvent } from '@/lib/automation/execute-automation-event';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_EVENT_TYPES = new Set([
  'contract_signed_admin',
  'contract_signed_client',
  'invite_member',
  'contract_review_released_client',
  'repertoire_review_released_client',
  'event_day_confirmation_client',
  'repertoire_pending_15_days_client',
  'payment_pending_2_days_client',
  'post_event_review_request_client',
  'schedule_pending_15_days_admin',
]);

function asString(value) {
  return String(value || '').trim();
}

export async function POST(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      moduleKey: 'automacoes',
      actionKey: 'write',
      logPrefix: '[AUTOMATION_TEST_DISPATCH_API]',
    });

    if (!auth.ok) {
      return NextResponse.json(auth, { status: auth.status || 401 });
    }

    const body = await request.json().catch(() => ({}));
    const eventType = asString(body?.eventType || body?.event_type);
    const entityId = asString(body?.entityId || body?.entity_id);
    const workspaceId = asString(body?.workspaceId || body?.workspace_id || auth.workspaceId);

    if (!eventType || !ALLOWED_EVENT_TYPES.has(eventType)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Tipo de automação inválido ou não permitido para teste.',
          allowedEventTypes: Array.from(ALLOWED_EVENT_TYPES),
        },
        { status: 400 }
      );
    }

    if (!entityId) {
      return NextResponse.json(
        {
          ok: false,
          message: 'entityId é obrigatório para testar a automação.',
        },
        { status: 400 }
      );
    }

    console.info('[AUTOMATION_TEST_DISPATCH_API][START]', {
      eventType,
      entityId,
      workspaceId,
      authWorkspaceId: auth.workspaceId,
      userId: auth.userId || null,
    });

    const result = await executeAutomationEvent({
      eventType,
      entityId,
      workspaceId,
    });

    console.info('[AUTOMATION_TEST_DISPATCH_API][RESULT]', {
      eventType,
      entityId,
      workspaceId,
      ok: result?.ok ?? null,
      sent: result?.sent ?? null,
      skipped: result?.skipped ?? null,
      failed: result?.failed ?? null,
      message: result?.message || null,
    });

    return NextResponse.json({
      ok: true,
      eventType,
      entityId,
      workspaceId,
      result,
    });
  } catch (error) {
    console.error('[AUTOMATION_TEST_DISPATCH_API][ERROR]', {
      message: error?.message || String(error),
      code: error?.code || null,
      details: error?.details || null,
      hint: error?.hint || null,
    });

    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'Erro ao testar automação.',
        code: error?.code || null,
        details: error?.details || null,
        hint: error?.hint || null,
      },
      { status: 500 }
    );
  }
}
