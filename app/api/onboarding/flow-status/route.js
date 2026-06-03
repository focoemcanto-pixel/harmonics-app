import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess, requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';
import { buildOnboardingFlowStatus } from '@/lib/onboarding/onboarding-flow';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_PROGRESS = {
  workspace_configured: false,
  template_created: false,
  event_type_created: false,
  precontract_created: false,
  contract_signed_test: false,
  first_event_created: false,
  automation_configured: false,
  team_configured: false,
  completed_at: null,
  flow_state: {},
};

const GUIDE_VIEW_MARKS = {
  'member-panel': 'hasMemberPanelViewed',
  'member-panel-demo': 'hasMemberPanelViewed',
  automations: 'hasAutomationsViewed',
  'automation-overview': 'hasAutomationsViewed',
  finance: 'hasFinanceViewed',
  'admin-repertoire': 'hasAdminRepertoireViewed',
  'dashboard-demo': 'hasDashboardDemoViewed',
  'client-contract': 'client_contract_opened',
  'client-contract-success': 'client_contract_signed',
  'client-panel': 'client_panel_opened',
  'cleanup-fake-event': 'returned_to_admin',
  template: 'contract_template_completed',
};

const ALLOWED_FLOW_STATE_KEYS = new Set([
  'onboarding_enabled',
  'workspace_created_for_onboarding',
  'client_contract_opened',
  'client_contract_signed',
  'signed_pdf_opened',
  'client_panel_opened',
  'client_panel_tour_completed',
  'member_panel_tour_completed',
  'returned_to_admin',
  'demo_event_cleanup_completed',
  'onboarding_completed',
  'contract_template_completed',
  'skipped',
  'onboarding_skipped',
]);

const HARMONICS_PRIMARY_WORKSPACE_ID = 'f36dcd9b-22a9-487a-bf2e-691d17bd6294';

function isMissingColumnError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  return code === '42703' || message.includes('does not exist') || message.includes('could not find') || details.includes('schema cache');
}

function isPrimaryHarmonicsWorkspace(workspace) {
  if (String(workspace?.id || '').trim() === HARMONICS_PRIMARY_WORKSPACE_ID) return true;
  const key = String(workspace?.key || '').trim().toLowerCase();
  const slug = String(workspace?.slug || '').trim().toLowerCase();
  const name = String(workspace?.name || '').trim().toLowerCase();
  if (key === 'default') return true;
  if (slug === 'harmonics-producao') return true;
  if (name.includes('harmonics') && (slug === 'harmonics-producao' || key === 'default')) return true;
  return false;
}

function normalizeFlowState(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function hasCount(response) {
  return Number(response?.count || 0) > 0;
}

function requestCameFromFreshWorkspaceDashboard(request) {
  const referer = String(request?.headers?.get('referer') || '');
  if (!referer) return false;
  try {
    const url = new URL(referer);
    return url.pathname === '/dashboard' && url.searchParams.get('onboarding') === 'fresh-workspace';
  } catch {
    return referer.includes('/dashboard') && referer.includes('onboarding=fresh-workspace');
  }
}

async function safeCount(queryPromise, label) {
  try {
    const response = await queryPromise;
    if (response?.error) {
      console.warn('[ONBOARDING_FLOW_STATUS][COUNT_ERROR]', { label, message: response.error?.message, code: response.error?.code });
      return { count: 0 };
    }
    return response || { count: 0 };
  } catch (error) {
    console.warn('[ONBOARDING_FLOW_STATUS][COUNT_EXCEPTION]', { label, message: error?.message, code: error?.code });
    return { count: 0 };
  }
}

async function safeMaybeSingle(queryPromise, label) {
  try {
    const response = await queryPromise;
    if (response?.error) {
      console.warn('[ONBOARDING_FLOW_STATUS][QUERY_ERROR]', { label, message: response.error?.message, code: response.error?.code });
      return null;
    }
    return response?.data || null;
  } catch (error) {
    console.warn('[ONBOARDING_FLOW_STATUS][QUERY_EXCEPTION]', { label, message: error?.message, code: error?.code });
    return null;
  }
}

async function getProgressRow({ supabase, workspaceId }) {
  const existing = await safeMaybeSingle(
    supabase.from('workspace_onboarding_progress').select('*').eq('workspace_id', workspaceId).maybeSingle(),
    'workspace_onboarding_progress.select'
  );
  if (existing?.workspace_id || existing?.id) return existing;

  const now = new Date().toISOString();
  const insertPayload = { workspace_id: workspaceId, ...DEFAULT_PROGRESS, updated_at: now };

  try {
    let response = await supabase.from('workspace_onboarding_progress').insert(insertPayload).select('*').single();
    if (response?.error && isMissingColumnError(response.error)) {
      response = await supabase.from('workspace_onboarding_progress').insert({ workspace_id: workspaceId }).select('*').single();
    }
    if (response?.error) {
      console.warn('[ONBOARDING_FLOW_STATUS][PROGRESS_INSERT_ERROR]', { message: response.error?.message, code: response.error?.code });
      return { workspace_id: workspaceId, flow_state: {} };
    }
    return response?.data || { workspace_id: workspaceId, flow_state: {} };
  } catch (error) {
    console.warn('[ONBOARDING_FLOW_STATUS][PROGRESS_INSERT_EXCEPTION]', { message: error?.message, code: error?.code });
    return { workspace_id: workspaceId, flow_state: {} };
  }
}

async function updateProgressFlowState({ supabase, workspaceId, progress, flowState }) {
  const now = new Date().toISOString();
  const payloads = [
    { flow_state: flowState, completed_at: null, updated_at: now },
    { flow_state: flowState, updated_at: now },
    { flow_state: flowState },
  ];

  for (const payload of payloads) {
    const response = await supabase
      .from('workspace_onboarding_progress')
      .update(payload)
      .eq('workspace_id', workspaceId)
      .select('*')
      .maybeSingle();

    if (!response.error && response.data) return response.data;
    if (response.error && !isMissingColumnError(response.error)) break;
  }

  for (const payload of payloads) {
    const response = await supabase
      .from('workspace_onboarding_progress')
      .insert({ workspace_id: workspaceId, ...payload })
      .select('*')
      .single();

    if (!response.error && response.data) return response.data;
    if (response.error && !isMissingColumnError(response.error)) break;
  }

  return { ...progress, workspace_id: workspaceId, flow_state: flowState };
}

async function maybeEnableFreshWorkspaceOnboarding({ supabase, request, workspaceId, workspace, progress }) {
  const primaryWorkspace = isPrimaryHarmonicsWorkspace(workspace);
  const flowState = normalizeFlowState(progress?.flow_state);
  const alreadyEnabled = flowState.onboarding_enabled === true || flowState.workspace_created_for_onboarding === true;
  const completed = Boolean(progress?.completed_at || flowState.onboarding_completed === true || flowState.onboardingCompleted === true);

  if (primaryWorkspace || alreadyEnabled || completed) return progress;
  if (!requestCameFromFreshWorkspaceDashboard(request)) return progress;

  const now = new Date().toISOString();
  const nextFlowState = {
    ...flowState,
    onboarding_enabled: true,
    workspace_created_for_onboarding: true,
    onboarding_started_at: flowState.onboarding_started_at || now,
    auto_healed_from_fresh_workspace_route: true,
    updatedAt: now,
  };

  return updateProgressFlowState({ supabase, workspaceId, progress, flowState: nextFlowState });
}

async function getDemoEvent({ supabase, workspaceId }) {
  const queries = [
    () => supabase
      .from('events')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('is_demo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    () => supabase
      .from('events')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('source', 'onboarding_demo')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    () => supabase
      .from('events')
      .select('id')
      .eq('workspace_id', workspaceId)
      .contains('metadata', { is_onboarding_demo: true })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ];

  for (const buildQuery of queries) {
    const row = await safeMaybeSingle(buildQuery(), 'events.demo');
    if (row?.id) return row;
  }

  return null;
}

async function countFacts({ supabase, workspaceId, progress }) {
  const [eventTypesResp, precontractsResp, signedContractsResp, membersResp, templatesResp, formationTemplatesResp] = await Promise.all([
    safeCount(supabase.from('event_types').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId), 'event_types'),
    safeCount(supabase.from('precontracts').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId), 'precontracts'),
    safeCount(supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).in('status', ['signed', 'assinado', 'ASSINADO']), 'contracts.signed'),
    safeCount(supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).in('contact_type', ['musician', 'member', 'team', 'staff']), 'contacts.members'),
    safeCount(supabase.from('contract_templates').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('is_active', true), 'contract_templates'),
    safeCount(supabase.from('scale_templates').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('is_active', true), 'scale_templates'),
  ]);

  const flowState = normalizeFlowState(progress?.flow_state);
  const memberPanelTourCompleted = flowState.member_panel_tour_completed === true;
  const hasMemberPanelViewed = flowState.hasMemberPanelViewed === true || memberPanelTourCompleted;
  const demoEvent = await getDemoEvent({ supabase, workspaceId });
  const demoEventId = demoEvent?.id || flowState.demo_event_id || null;
  const scaleResp = demoEventId
    ? await safeCount(supabase.from('event_musicians').select('event_id', { count: 'exact', head: true }).eq('event_id', demoEventId), 'event_musicians.demo_event')
    : { count: 0 };

  return {
    workspaceId,
    demoEventId,
    flow_state: flowState,
    hasContractTemplate: progress?.template_created === true || hasCount(templatesResp) || flowState.contract_template_completed === true,
    hasEventType: progress?.event_type_created === true || hasCount(eventTypesResp),
    hasPrecontract: progress?.precontract_created === true || hasCount(precontractsResp),
    hasSignedContract: progress?.contract_signed_test === true || hasCount(signedContractsResp) || flowState.client_contract_signed === true,
    hasClientRepertoireSubmitted: flowState.client_panel_tour_completed === true,
    hasFakeMembers: progress?.team_configured === true || Number(membersResp?.count || 0) >= 2,
    hasFormationTemplate: hasCount(formationTemplatesResp),
    formationTemplateCount: Number(formationTemplatesResp?.count || 0),
    hasScale: progress?.first_event_created === true || hasCount(scaleResp),
    hasMemberPanelViewed,
    memberPanelTourCompleted,
    hasAutomationsViewed: flowState.hasAutomationsViewed === true || progress?.automation_configured === true,
    hasFinanceViewed: flowState.hasFinanceViewed === true,
    hasAdminRepertoireViewed: flowState.hasAdminRepertoireViewed === true,
    hasDashboardDemoViewed: flowState.hasDashboardDemoViewed === true,
    canCleanupDemoEvent: Boolean(demoEventId && flowState.demo_event_cleanup_completed !== true),
    isComplete: Boolean(progress?.completed_at || flowState.onboardingCompleted === true || flowState.onboarding_completed === true),
  };
}

function buildFallbackFlow(facts) {
  try {
    return buildOnboardingFlowStatus(facts) || {};
  } catch (error) {
    console.warn('[ONBOARDING_FLOW_STATUS][FLOW_BUILD_ERROR]', { message: error?.message });
    return { currentStep: 'template', nextStep: 'template', nextHref: '/contratos/templates?guide=template' };
  }
}

export async function GET(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({ supabase, request, logPrefix: '[ONBOARDING_FLOW_STATUS][GET]' });
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });

    let progress = await getProgressRow({ supabase, workspaceId: auth.workspaceId });
    progress = await maybeEnableFreshWorkspaceOnboarding({
      supabase,
      request,
      workspaceId: auth.workspaceId,
      workspace: auth.workspace,
      progress,
    });

    const facts = await countFacts({ supabase, workspaceId: auth.workspaceId, progress });
    const primaryWorkspace = isPrimaryHarmonicsWorkspace(auth.workspace);
    const flowState = normalizeFlowState(progress?.flow_state);
    const skipped = flowState.skipped === true || flowState.onboarding_skipped === true;
    const completed = Boolean(progress?.completed_at || flowState.onboardingCompleted === true || flowState.onboarding_completed === true);
    const onboardingEnabled = primaryWorkspace
      ? false
      : Boolean(flowState.onboarding_enabled === true || flowState.workspace_created_for_onboarding === true);
    const flow = buildFallbackFlow({ ...facts, onboardingEnabled, isComplete: completed });

    return NextResponse.json({
      ok: true,
      workspaceId: auth.workspaceId,
      progress,
      flow_state: flowState,
      onboardingEnabled,
      primaryWorkspace,
      skipped: primaryWorkspace ? true : skipped,
      completed: primaryWorkspace ? true : completed,
      ...facts,
      ...flow,
    });
  } catch (error) {
    console.error('[ONBOARDING_FLOW_STATUS][GET][ERROR]', { message: error?.message, code: error?.code, details: error?.details });
    return NextResponse.json({ ok: false, error: error?.message || 'Erro ao carregar status do onboarding.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAdmin({ supabase, request, logPrefix: '[ONBOARDING_FLOW_STATUS][PATCH]' });
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });

    const body = await request.json().catch(() => ({}));
    const guide = String(body?.guide || '').trim().toLowerCase();
    const markKey = GUIDE_VIEW_MARKS[guide];
    const requestedFlowState = body?.flowState && typeof body.flowState === 'object' ? body.flowState : {};
    const sanitizedFlowState = Object.fromEntries(Object.entries(requestedFlowState).filter(([key, value]) => ALLOWED_FLOW_STATE_KEYS.has(key) && value === true));

    if (!markKey && body?.completed !== true && Object.keys(sanitizedFlowState).length === 0) {
      return NextResponse.json({ ok: false, error: 'Guia de onboarding inválido.' }, { status: 400 });
    }

    const progress = await getProgressRow({ supabase, workspaceId: auth.workspaceId });
    const currentFlowState = normalizeFlowState(progress?.flow_state);
    const nextFlowState = {
      ...currentFlowState,
      ...(markKey ? { [markKey]: true } : {}),
      ...sanitizedFlowState,
      ...(body?.completed === true || sanitizedFlowState.onboarding_completed === true
        ? { onboardingEnabled: false, onboarding_enabled: false, onboarding_completed: true, onboardingCompleted: true }
        : {}),
      updatedAt: new Date().toISOString(),
    };

    const updated = await updateProgressFlowState({ supabase, workspaceId: auth.workspaceId, progress, flowState: nextFlowState });
    const facts = await countFacts({ supabase, workspaceId: auth.workspaceId, progress: updated });
    const primaryWorkspace = isPrimaryHarmonicsWorkspace(auth.workspace);
    const skipped = nextFlowState.skipped === true || nextFlowState.onboarding_skipped === true;
    const completed = Boolean(updated?.completed_at || nextFlowState.onboardingCompleted === true || nextFlowState.onboarding_completed === true);
    const onboardingEnabled = primaryWorkspace ? false : nextFlowState.onboarding_enabled === true || nextFlowState.workspace_created_for_onboarding === true;
    const flow = buildFallbackFlow({ ...facts, onboardingEnabled, isComplete: completed });

    return NextResponse.json({ ok: true, workspaceId: auth.workspaceId, progress: updated, flow_state: nextFlowState, onboardingEnabled, primaryWorkspace, skipped: primaryWorkspace ? true : skipped, completed: primaryWorkspace ? true : completed, ...facts, ...flow });
  } catch (error) {
    console.error('[ONBOARDING_FLOW_STATUS][PATCH][ERROR]', { message: error?.message, code: error?.code, details: error?.details });
    return NextResponse.json({ ok: false, error: error?.message || 'Erro ao atualizar status do onboarding.' }, { status: 500 });
  }
}
