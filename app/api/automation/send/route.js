import { NextResponse } from 'next/server';
import { executeAutomationEvent } from '@/lib/automation/execute-automation-event';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';

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

async function resolveEntityWorkspaceId({ supabase, eventType, entityId }) {
  if (!entityId) return null;

  if (eventType === 'invite_member') {
    const { data, error } = await supabase
      .from('invites')
      .select('event:events(workspace_id)')
      .eq('id', entityId)
      .maybeSingle();
    if (error) throw error;
    return String(data?.event?.workspace_id || '').trim() || null;
  }

  if (
    eventType === 'event_day_confirmation_client' ||
    eventType === 'repertoire_pending_15_days_client' ||
    eventType === 'payment_pending_2_days_client' ||
    eventType === 'post_event_review_request_client' ||
    eventType === 'schedule_pending_15_days_admin'
  ) {
    const { data, error } = await supabase
      .from('events')
      .select('workspace_id')
      .eq('id', entityId)
      .maybeSingle();
    if (error) throw error;
    return String(data?.workspace_id || '').trim() || null;
  }

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('event:events(workspace_id)')
    .eq('id', entityId)
    .maybeSingle();
  if (contractError) throw contractError;
  if (contract?.event?.workspace_id) return String(contract.event.workspace_id).trim();

  const { data: precontract, error: precontractError } = await supabase
    .from('precontracts')
    .select('event_id, workspace_id')
    .eq('id', entityId)
    .maybeSingle();
  if (precontractError && precontractError.code !== '42703') throw precontractError;
  if (precontract?.workspace_id) return String(precontract.workspace_id).trim();
  if (precontract?.event_id) {
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('workspace_id')
      .eq('id', precontract.event_id)
      .maybeSingle();
    if (eventError) throw eventError;
    return String(event?.workspace_id || '').trim() || null;
  }

  return null;
}

export async function POST(request) {
  const supabaseAdmin = getSupabaseAdmin();
  const internal = isAuthorizedInternalRequest(request);

  let auth = null;
  if (!internal) {
    auth = await requireWorkspaceAdmin({
      supabase: supabaseAdmin,
      request,
      logPrefix: '[AUTOMATION_SEND]',
    });

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: auth.error || 'Unauthorized' },
        { status: auth.status || 401 }
      );
    }
  }

  try {
    const body = await request.json().catch(() => ({}));
    const eventType = String(body?.eventType || '').trim();
    const entityId = String(body?.entityId || '').trim();
    const requestedWorkspaceId = String(body?.workspaceId || '').trim() || null;

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

    if (requestedWorkspaceId && !isUuid(requestedWorkspaceId)) {
      return NextResponse.json(
        { ok: false, error: 'workspaceId inválido' },
        { status: 400 }
      );
    }

    const entityWorkspaceId = await resolveEntityWorkspaceId({
      supabase: supabaseAdmin,
      eventType,
      entityId,
    });

    // Para requisições feitas pelo painel, o workspace autenticado é a fonte de verdade.
    // Não confiamos em workspaceId enviado pelo navegador.
    const workspaceId = internal
      ? requestedWorkspaceId || entityWorkspaceId
      : String(auth?.workspaceId || '').trim() || null;

    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: 'Workspace real da automação não resolvido.' },
        { status: 422 }
      );
    }

    if (entityWorkspaceId && entityWorkspaceId !== workspaceId) {
      return NextResponse.json(
        { ok: false, error: 'A entidade selecionada pertence a outro workspace.' },
        { status: 403 }
      );
    }

    console.info('[AUTOMATION_SEND][WORKSPACE_RESOLVED]', {
      eventType,
      entityId,
      workspaceId,
      entityWorkspaceId,
      source: internal ? 'internal' : 'authenticated_workspace',
    });

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
