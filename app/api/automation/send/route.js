import { NextResponse } from 'next/server';
import { executeAutomationEvent } from '@/lib/automation/execute-automation-event';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';

const SUPPORTED_EVENT_TYPES = [
  'invite_member',
  'contract_signed_admin',
  'contract_signed_client',
  'contract_review_released_client',
  'repertoire_review_released_client',
  'event_day_confirmation_client',
  'repertoire_pending_15_days_client',
  'payment_pending_2_days_client',
  'post_event_review_request_client',
  'schedule_pending_15_days_admin',
];

const SUPPORTED_EVENT_TYPE_SET = new Set(SUPPORTED_EVENT_TYPES);

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function isAuthorizedInternalRequest(request) {
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (!internalSecret) return false;

  const headerSecret = request.headers.get('x-internal-api-secret');
  return headerSecret === internalSecret;
}

async function requireAutomationSendAccess(request) {
  if (isAuthorizedInternalRequest(request)) {
    return { ok: true, source: 'internal' };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const auth = await requireAdmin({
    supabase: supabaseAdmin,
    request,
    logPrefix: '[AUTOMATION_SEND]',
  });

  return auth;
}

export async function POST(request) {
  const auth = await requireAutomationSendAccess(request);

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error || 'Unauthorized' },
      { status: auth.status || 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const eventType = String(body?.eventType || '').trim();
    const entityId = String(body?.entityId || '').trim();
    const workspaceId = String(body?.workspaceId || '').trim() || undefined;

    if (!eventType || !entityId) {
      return NextResponse.json(
        { ok: false, error: 'Campos obrigatórios: eventType, entityId' },
        { status: 400 }
      );
    }

    if (!SUPPORTED_EVENT_TYPE_SET.has(eventType)) {
      return NextResponse.json(
        { ok: false, error: 'Event type not supported yet', supported: SUPPORTED_EVENT_TYPES },
        { status: 400 }
      );
    }

    if (!isUuid(entityId)) {
      return NextResponse.json(
        { ok: false, error: 'entityId inválido' },
        { status: 400 }
      );
    }

    if (workspaceId && !isUuid(workspaceId)) {
      return NextResponse.json(
        { ok: false, error: 'workspaceId inválido' },
        { status: 400 }
      );
    }

    const result = await executeAutomationEvent({ eventType, entityId, workspaceId });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[POST /api/automation/send] Erro:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
