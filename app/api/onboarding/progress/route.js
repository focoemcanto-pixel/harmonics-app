import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess, requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';
import { ONBOARDING_STEPS, calculateOnboardingProgress } from '@/lib/onboarding/tourRegistry';

const STEP_KEYS = new Set(ONBOARDING_STEPS.map((step) => step.key));

const LEGACY_WORKSPACE_KEYS = new Set(
  String(process.env.HARMONICS_LEGACY_WORKSPACE_SLUGS || 'harmonics,harmonics-producao,default')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
);

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

const ALL_DONE_PROGRESS = Object.fromEntries(
  Object.keys(DEFAULT_PROGRESS).map((key) => [key, true])
);

const MIN_VALID_TEMPLATE_CONTENT_LENGTH = 20;

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

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTemplateContentLength(template) {
  return Math.max(
    stripHtml(template?.content).length,
    stripHtml(template?.source_text).length,
    stripHtml(template?.source_rich_html).length
  );
}

function isValidContractTemplate(template, workspaceId) {
  return Boolean(
    template?.id &&
    template?.workspace_id &&
    String(template.workspace_id) === String(workspaceId) &&
    template?.is_active !== false &&
    getTemplateContentLength(template) >= MIN_VALID_TEMPLATE_CONTENT_LENGTH
  );
}

async function safeList(queryPromise) {
  try {
    const response = await queryPromise;
    if (response?.error) return [];
    return response?.data || [];
  } catch (error) {
    console.warn('[ONBOARDING_PROGRESS][SAFE_LIST_ERROR]', error?.message || error);
    return [];
  }
}

async function hasValidContractTemplate({ supabase, workspaceId }) {
  const templates = await safeList(
    supabase
      .from('contract_templates')
      .select('id, workspace_id, content, source_text, source_rich_html, is_active')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .limit(100)
  );

  return templates.some((template) => isValidContractTemplate(template, workspaceId));
}

async function getWorkspaceInfo({ supabase, workspaceId }) {
  const { data, error } = await supabase
    .from('workspaces')
    .select('id, slug, key, name')
    .eq('id', workspaceId)
    .maybeSingle();

  if (error) {
    console.warn('[ONBOARDING_PROGRESS][WORKSPACE_INFO_ERROR]', error?.message || error);
    return { id: workspaceId };
  }

  return data || { id: workspaceId };
}

function isLegacyWorkspace(workspace) {
  const keys = [workspace?.slug, workspace?.key, workspace?.name]
    .map((item) => String(item || '').trim().toLowerCase())
    .filter(Boolean);

  return keys.some((key) => LEGACY_WORKSPACE_KEYS.has(key));
}

async function detectWorkspaceProgress({ supabase, workspaceId }) {
  const [
    hasTemplate,
    eventTypesResp,
    precontractsResp,
    signedContractsResp,
    eventsResp,
    channelsResp,
    membersResp,
  ] = await Promise.all([
    hasValidContractTemplate({ supabase, workspaceId }),
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
    workspace_configured: false,
    template_created: hasTemplate,
    event_type_created: hasCount(eventTypesResp),
    precontract_created: hasCount(precontractsResp),
    contract_signed_test: hasCount(signedContractsResp),
    first_event_created: hasCount(eventsResp),
    automation_configured: hasCount(channelsResp),
    team_configured: Number(membersResp?.count || 0) > 1,
  };
}

async function syncDetectedProgress({ supabase, workspaceId, progress }) {
  if (progress?.completed_at) return progress;

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
  updatePayload.completed_at = summary.completed === summary.total
    ? new Date().toISOString()
    : progress.completed_at || null;

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
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      logPrefix: '[ONBOARDING_PROGRESS][GET]',
    });

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: auth.error },
        { status: auth.status || 401 }
      );
    }

    const workspace = await getWorkspaceInfo({
      supabase,
      workspaceId: auth.workspaceId,
    });

    const row = await ensureProgressRow({
      supabase,
      workspaceId: auth.workspaceId,
    });

    let progress = await syncDetectedProgress({
      supabase,
      workspaceId: auth.workspaceId,
      progress: row,
    });

    if (isLegacyWorkspace(workspace) && !progress.completed_at) {
      const { data: hiddenProgress, error } = await supabase
        .from('workspace_onboarding_progress')
        .update({
          ...ALL_DONE_PROGRESS,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', auth.workspaceId)
        .select('*')
        .single();

      if (error) throw error;
      progress = hiddenProgress;
    }

    const summary = calculateOnboardingProgress(progress);

    return NextResponse.json({
      ok: true,
      workspaceId: auth.workspaceId,
      showOnboarding: summary.percentage < 100,
      progress,
      summary,
      steps: ONBOARDING_STEPS,
    });
  } catch (error) {
    console.error('[ONBOARDING_PROGRESS][GET][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Erro ao carregar progresso do onboarding.',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAdmin({
      supabase,
      request,
      logPrefix: '[ONBOARDING_PROGRESS][PATCH]',
    });

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: auth.error },
        { status: auth.status || 401 }
      );
    }

    const body = await request.json().catch(() => ({}));

    if (body?.skipOnboarding === true) {
      await ensureProgressRow({
        supabase,
        workspaceId: auth.workspaceId,
      });

      const { data: skipped, error: skipError } = await supabase
        .from('workspace_onboarding_progress')
        .update({
          ...ALL_DONE_PROGRESS,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', auth.workspaceId)
        .select('*')
        .single();

      if (skipError) throw skipError;

      return NextResponse.json({
        ok: true,
        skipped: true,
        progress: skipped,
        summary: calculateOnboardingProgress(skipped),
      });
    }

    const stepKey = String(body?.stepKey || '').trim();
    const completed = body?.completed !== false;

    if (!STEP_KEYS.has(stepKey)) {
      return NextResponse.json(
        { ok: false, error: 'Etapa de onboarding inválida.' },
        { status: 400 }
      );
    }

    await ensureProgressRow({
      supabase,
      workspaceId: auth.workspaceId,
    });

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
      completed_at: summary.completed === summary.total
        ? new Date().toISOString()
        : null,
    };

    if (finalPayload.completed_at !== updated.completed_at) {
      const { data: finalUpdated, error: finalError } = await supabase
        .from('workspace_onboarding_progress')
        .update({
          completed_at: finalPayload.completed_at,
          updated_at: new Date().toISOString(),
        })
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
      {
        ok: false,
        error: error?.message || 'Erro ao atualizar progresso do onboarding.',
      },
      { status: 500 }
    );
  }
}
