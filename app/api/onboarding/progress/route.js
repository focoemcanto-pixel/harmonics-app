import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess, requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';
import { ONBOARDING_STEPS, calculateOnboardingProgress } from '@/lib/onboarding/tourRegistry';

const STEP_KEYS = new Set(ONBOARDING_STEPS.map((step) => step.key));

const DEFAULT_PROGRESS = {
  workspace_configured: false,
  template_created: false,
  event_type_created: false,
  precontract_created: false,
  contract_signed_test: false,
  first_event_created: false,
  automation_configured: false,
  team_configured: false,
};

async function ensureProgressRow({ supabase, workspaceId }) {
  const { data: existing, error: existingError } = await supabase
    .from('workspace_onboarding_progress')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return existing;

  const { data: inserted, error: insertError } = await supabase
    .from('workspace_onboarding_progress')
    .insert({ workspace_id: workspaceId, ...DEFAULT_PROGRESS })
    .select('*')
    .single();

  if (insertError) throw insertError;
  return inserted;
}

function hasCount(response) {
  return Number(response?.count || 0) > 0;
}

async function safeCount(queryPromise) {
  try {
    return await queryPromise;
  } catch (error) {
    console.warn('[ONBOARDING_PROGRESS][SAFE_COUNT_ERROR]', error?.message || error);
    return { count: 0, error };
  }
}

async function detectWorkspaceProgress({ supabase, workspaceId }) {
  const [
    workspaceResp,
    templatesResp,
    eventTypesResp,
    precontractsResp,
    signedContractsResp,
    eventsResp,
    channelsResp,
    membersResp,
  ] = await Promise.all([
    safeCount(
      supabase
        .from('workspaces')
        .select('id', { count: 'exact', head: true })
        .eq('id', workspaceId)
    ),
    safeCount(
      supabase
        .from('contract_templates')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
    ),
    safeCount(
      supabase
        .from('event_types')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
    ),
    safeCount(
      supabase
        .from('precontracts')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
    ),
    safeCount(
      supabase
        .from('contracts')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .in('status', ['signed', 'assinado', 'ASSINADO'])
    ),
    safeCount(
      supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
    ),
    safeCount(
      supabase
        .from('whatsapp_channels')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
    ),
    safeCount(
      supabase
        .from('workspace_members')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
    ),
  ]);

  return {
    workspace_configured: hasCount(workspaceResp),
    template_created: hasCount(templatesResp),
    event_type_created: hasCount(eventTypesResp),
    precontract_created: hasCount(precontractsResp),
    contract_signed_test: hasCount(signedContractsResp),
    first_event_created: hasCount(eventsResp),
    automation_configured: hasCount(channelsResp),
    team_configured: Number(membersResp?.count || 0) > 1,
  };
}

async function syncDetectedProgress({ supabase, workspaceId, progress }) {
  const detected = await detectWorkspaceProgress({ supabase, workspaceId });
  const updatePayload = { updated_at: new Date().toISOString() };
  let changed = false;

  for (const [key, value] of Object.entries(detected)) {
    if (value === true && progress?.[key] !== true) {
      updatePayload[key] = true;
      changed = true;
    }
  }

  if (!changed) return progress;

  const mergedForSummary = { ...progress, ...updatePayload };
  const summary = calculateOnboardingProgress(mergedForSummary);
  updatePayload.completed_at = summary.completed === summary.total ? new Date().toISOString() : progress.completed_at || null;

  const { data: updated, error } = await supabase
    .from('workspace_onboarding_progress')
    .update(updatePayload)
    .eq('workspace_id', workspaceId)
    .select('*')
    .single();

  if (error) throw error;
  return updated;
}

export async function GET(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({ supabase, request, logPrefix: '[ONBOARDING_PROGRESS][GET]' });
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
    }

    const row = await ensureProgressRow({ supabase, workspaceId: auth.workspaceId });
    const progress = await syncDetectedProgress({ supabase, workspaceId: auth.workspaceId, progress: row });

    return NextResponse.json({
      ok: true,
      workspaceId: auth.workspaceId,
      progress,
      summary: calculateOnboardingProgress(progress),
      steps: ONBOARDING_STEPS,
    });
  } catch (error) {
    console.error('[ONBOARDING_PROGRESS][GET][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao carregar progresso do onboarding.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAdmin({ supabase, request, logPrefix: '[ONBOARDING_PROGRESS][PATCH]' });
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
    }

    const body = await request.json().catch(() => ({}));
    const stepKey = String(body?.stepKey || '').trim();
    const completed = body?.completed !== false;

    if (!STEP_KEYS.has(stepKey)) {
      return NextResponse.json({ ok: false, error: 'Etapa de onboarding inválida.' }, { status: 400 });
    }

    await ensureProgressRow({ supabase, workspaceId: auth.workspaceId });

    const updatePayload = {
      [stepKey]: completed,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: updateError } = await supabase
      .from('workspace_onboarding_progress')
      .update(updatePayload)
      .eq('workspace_id', auth.workspaceId)
      .select('*')
      .single();

    if (updateError) throw updateError;

    const summary = calculateOnboardingProgress(updated);

    const finalPayload = {
      ...updated,
      completed_at: summary.completed === summary.total ? new Date().toISOString() : null,
    };

    if (finalPayload.completed_at !== updated.completed_at) {
      const { data: finalUpdated, error: finalError } = await supabase
        .from('workspace_onboarding_progress')
        .update({ completed_at: finalPayload.completed_at, updated_at: new Date().toISOString() })
        .eq('workspace_id', auth.workspaceId)
        .select('*')
        .single();

      if (finalError) throw finalError;

      return NextResponse.json({
        ok: true,
        progress: finalUpdated,
        summary: calculateOnboardingProgress(finalUpdated),
      });
    }

    return NextResponse.json({
      ok: true,
      progress: updated,
      summary,
    });
  } catch (error) {
    console.error('[ONBOARDING_PROGRESS][PATCH][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao atualizar progresso do onboarding.' },
      { status: 500 }
    );
  }
}
