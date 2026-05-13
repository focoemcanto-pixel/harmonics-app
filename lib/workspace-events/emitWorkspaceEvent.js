import { getOnboardingStepForWorkspaceEvent } from '@/lib/workspace-events/eventTypes';

export async function emitWorkspaceEvent({
  supabase,
  workspaceId,
  type,
  metadata = {},
}) {
  try {
    if (!supabase || !workspaceId || !type) {
      return { ok: false, skipped: true };
    }

    const normalizedType = String(type).trim();
    const now = new Date().toISOString();

    const onboardingStep = getOnboardingStepForWorkspaceEvent(normalizedType);

    const activityPayload = {
      workspace_id: workspaceId,
      type: normalizedType,
      metadata,
      created_at: now,
    };

    const { error: activityError } = await supabase
      .from('workspace_activity_events')
      .insert(activityPayload);

    if (activityError) {
      console.warn('[WORKSPACE_EVENTS][ACTIVITY_LOG_ERROR]', {
        message: activityError?.message,
        type: normalizedType,
      });
    }

    if (onboardingStep) {
      const { data: existing } = await supabase
        .from('workspace_onboarding_progress')
        .select('id, completed_at')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (!existing?.id) {
        await supabase
          .from('workspace_onboarding_progress')
          .insert({
            workspace_id: workspaceId,
            [onboardingStep]: true,
            updated_at: now,
          });
      } else if (!existing.completed_at) {
        await supabase
          .from('workspace_onboarding_progress')
          .update({
            [onboardingStep]: true,
            updated_at: now,
          })
          .eq('workspace_id', workspaceId);
      }
    }

    return {
      ok: true,
      onboardingStep,
    };
  } catch (error) {
    console.warn('[WORKSPACE_EVENTS][EMIT_ERROR]', {
      message: error?.message,
      type,
    });

    return {
      ok: false,
      error,
    };
  }
}
