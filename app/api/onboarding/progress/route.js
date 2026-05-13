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

export async function GET(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({ supabase, request, logPrefix: '[ONBOARDING_PROGRESS][GET]' });
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
    }

    const progress = await ensureProgressRow({ supabase, workspaceId: auth.workspaceId });

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
