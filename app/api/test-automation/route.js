import { NextResponse } from 'next/server';
import { getDefaultWorkspaceSettings } from '@/lib/automation/get-workspace';
import { safeLogDispatch } from '@/lib/automation/log-dispatch';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const workspace = await getDefaultWorkspaceSettings();
    const entityId = body?.entityId || `test-${Date.now()}`;
    const recipient = body?.recipient || '5511999999999';

    console.info('[automation][step] test_automation_started', {
      workspaceId: workspace.id,
      entityId,
      recipient,
    });

    const logResult = await safeLogDispatch({
      workspaceId: workspace.id,
      ruleId: null,
      templateId: null,
      channelId: null,
      entityId,
      entityType: 'test',
      recipientType: 'admin',
      recipient,
      renderedMessage: '[TEST] Pipeline de automação validado manualmente',
      metadata: {
        eventType: 'test_automation',
        stage: 'manual_pipeline_validation',
      },
      providerResponse: {
        fake: true,
        provider: 'wasender',
        accepted: true,
      },
      status: body?.forceFail ? 'failed' : 'sent',
      errorMessage: body?.forceFail ? 'Falha forçada de teste' : null,
      source: 'automation_center',
    });

    return NextResponse.json({
      ok: true,
      workspaceId: workspace.id,
      entityId,
      simulatedSend: true,
      logResult,
    });
  } catch (error) {
    console.error('[automation][step] test_automation_failed', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno no teste de automação' },
      { status: 500 }
    );
  }
}
