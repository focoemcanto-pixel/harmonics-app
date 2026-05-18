import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { deleteEventCascade } from '@/lib/events/delete-event-cascade';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';

function isDemoEvent(event) {
  const metadata = event?.metadata && typeof event.metadata === 'object' ? event.metadata : {};
  return Boolean(
    metadata?.is_onboarding_demo === true ||
    event?.source === 'onboarding_demo' ||
    event?.is_demo === true
  );
}

async function getEventForWorkspace({ supabase, eventId, workspaceId }) {
  const { data, error } = await supabase
    .from('events')
    .select('id, workspace_id, metadata, source, is_demo')
    .eq('id', eventId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function canCleanupDemoEventNow({ supabase, workspaceId }) {
  const { data: progress, error } = await supabase
    .from('workspace_onboarding_progress')
    .select('flow_state')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error) throw error;

  const flowState = progress?.flow_state && typeof progress.flow_state === 'object' ? progress.flow_state : {};
  return Boolean(
    flowState.client_panel_tour_completed === true ||
    (flowState.hasMemberPanelViewed === true &&
      flowState.hasAutomationsViewed === true &&
      flowState.hasFinanceViewed === true &&
      flowState.hasAdminRepertoireViewed === true &&
      flowState.hasDashboardDemoViewed === true)
  );
}

export async function DELETE(request, context) {
  const supabase = getSupabaseAdmin();
  const routeParams = await context?.params;
  const eventId = String(routeParams?.id || '').trim();

  console.info('[EVENT_DELETE_API][DELETE][START]', { mode: 'single' });
  console.info('[EVENT_DELETE_API][DELETE][TABLE]', { table: 'events (+ dependências)' });
  console.info('[EVENT_DELETE_API][DELETE][IDS]', { eventIds: [eventId] });

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      moduleKey: 'events',
      actionKey: 'write',
      logPrefix: '[EVENT_DELETE_API]',
    });

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: auth.error || 'Acesso não autorizado.' },
        { status: auth.status || 401 }
      );
    }

    if (!eventId) {
      return NextResponse.json({ ok: false, error: 'ID do evento é obrigatório.' }, { status: 400 });
    }

    const event = await getEventForWorkspace({
      supabase,
      eventId,
      workspaceId: auth.workspaceId,
    });

    if (!event?.id) {
      return NextResponse.json(
        { ok: false, error: 'Evento não encontrado neste workspace.' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const isOnboardingCleanup = searchParams.get('guide') === 'cleanup-fake-event' || searchParams.get('onboardingCleanup') === '1';
    if (isOnboardingCleanup) {
      if (!isDemoEvent(event)) {
        return NextResponse.json(
          { ok: false, error: 'O cleanup do onboarding só pode apagar evento marcado como demo.' },
          { status: 403 }
        );
      }

      const cleanupUnlocked = await canCleanupDemoEventNow({
        supabase,
        workspaceId: auth.workspaceId,
      });
      if (!cleanupUnlocked) {
        return NextResponse.json(
          { ok: false, error: 'Finalize painel do membro, automações, financeiro, repertório/admin e dashboard antes do cleanup.' },
          { status: 409 }
        );
      }
    }

    const result = await deleteEventCascade({
      supabase,
      eventId,
      logPrefix: '[EVENT_DELETE_API]',
    });

    if (!result?.ok) {
      return NextResponse.json(
        { ok: false, error: result?.error || 'Falha ao excluir evento.' },
        { status: result?.status || 500 }
      );
    }

    console.info('[EVENT_DELETE_API][DELETE][RESULT]', {
      requested: 1,
      success: result?.deletedId ? 1 : 0,
      failed: result?.deletedId ? 0 : 1,
    });

    if (isOnboardingCleanup && result?.deletedId) {
      const { data: progress } = await supabase
        .from('workspace_onboarding_progress')
        .select('flow_state')
        .eq('workspace_id', auth.workspaceId)
        .maybeSingle();
      const currentFlowState = progress?.flow_state && typeof progress.flow_state === 'object' ? progress.flow_state : {};
      await supabase
        .from('workspace_onboarding_progress')
        .update({
          flow_state: {
            ...currentFlowState,
            demo_event_cleanup_completed: true,
            onboarding_completed: true,
            onboardingCompleted: true,
            demoEventDeletedAt: new Date().toISOString(),
          },
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', auth.workspaceId);
    }

    return NextResponse.json({
      ok: true,
      success: true,
      deleted: result?.deletedId ? 1 : 0,
      failed: result?.deletedId ? 0 : 1,
      deletedId: result.deletedId,
      cleanup: result.cleanup,
    });
  } catch (error) {
    console.error('[EVENT_DELETE_API][DELETE][ERROR]', {
      eventId,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'Erro inesperado ao excluir evento no servidor.',
      },
      { status: 500 }
    );
  }
}
