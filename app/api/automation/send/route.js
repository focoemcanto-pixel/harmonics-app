import { NextResponse } from 'next/server';
import { executeAutomationEvent } from '@/lib/automation/execute-automation-event';

const SUPPORTED_EVENT_TYPES = [
  'invite_member',
  'contract_signed_client',
  'repertoire_pending_15_days_client',
  'payment_pending_2_days_client',
  'post_event_review_request_client',
  'schedule_pending_15_days_admin',
];

export async function POST(request) {
  try {
    const body = await request.json();
    const { eventType, entityId, workspaceId } = body;

    if (!eventType || !entityId) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: eventType, entityId' },
        { status: 400 }
      );
    }

    if (!SUPPORTED_EVENT_TYPES.includes(eventType)) {
      return NextResponse.json(
        { error: 'Event type not supported yet', supported: SUPPORTED_EVENT_TYPES },
        { status: 400 }
      );
    }

    const result = await executeAutomationEvent({ eventType, entityId, workspaceId });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[POST /api/automation/send] Erro:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
