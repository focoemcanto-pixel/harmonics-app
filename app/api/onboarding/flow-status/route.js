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
  flow_state: {},
};

const GUIDE_VIEW_MARKS = {
  'member-panel': 'hasMemberPanelViewed',
  automations: 'hasAutomationsViewed',
  finance: 'hasFinanceViewed',
  'admin-repertoire': 'hasAdminRepertoireViewed',
  'dashboard-demo': 'hasDashboardDemoViewed',
};

function hasCount(response) {
  return Number(response?.count || 0) > 0;
}

async function safeCount(queryPromise, label) {
  const response = await queryPromise;
  if (response?.error) {
    console.warn('[ONBOARDING_FLOW_STATUS][COUNT_ERROR]', { label, message: response.error?.message, code: response.error?.code });
    return { count: 0 };
  }
  return response;
}

async function safeMaybeSingle(queryPromise, label) {
  const response = await queryPromise;
  if (response?.error) {
    console.warn('[ONBOARDING_FLOW_STATUS][QUERY_ERROR]', { label, message: response.error?.message, code: response.error?.code });
    return null;
  }
  return response?.data || null;
}

async function safeList(queryPromise, label) {
  const response = await queryPromise;
  if (response?.error) {
    console.warn('[ONBOARDING_FLOW_STATUS][LIST_ERROR]', { label, message: response.error?.message, code: response.error?.code });
    return [];
  }
  return response?.data || [];
}

function isDemoEvent(event) {
  const metadata = event?.metadata && typeof event.metadata === 'object' ? event.metadata : {};
  return Boolean(
    metadata?.is_onboarding_demo === true ||
    event?.source === 'onboarding_demo' ||
    event?.is_demo === true
  );
}

async function ensureProgressRow({ supabase, workspaceId }) {
  const existing = await safeMaybeSingle(
    supabase
      .from('workspace_onboarding_progress')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle(),
    'workspace_onboarding_progress.select'
  );
  if (existing?.id) return existing;

  const inserted = await supabase
    .from('workspace_onboarding_progress')
    .insert({ workspace_id: workspaceId, ...DEFAULT_PROGRESS })
    .select('*')
    .single();
  if (inserted.error) throw inserted.error;
  return inserted.data || { workspace_id: workspaceId, flow_state: {} };
}

async function getDemoEvent({ supabase, workspaceId }) {
  const markedEvents = await safeList(
    supabase
      .from('events')
      .select('id, workspace_id, created_at, metadata, source, is_demo')
      .eq('workspace_id', workspaceId)
      .or('is_demo.eq.true,source.eq.onboarding_demo,metadata->>is_onboarding_demo.eq.true')
      .order('created_at', { ascending: false })
      .limit(1),
    'events.demo_marked'
  );
  if (markedEvents[0]?.id) return markedEvents[0];

  const signedContract = await safeMaybeSingle(
    supabase
      .from('contracts')
      .select('event_id, signed_at, created_at')
      .eq('workspace_id', workspaceId)
      .in('status', ['signed', 'assinado', 'ASSINADO'])
      .not('event_id', 'is', null)
      .order('signed_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    'contracts.latest_signed_event'
  );

  if (!signedContract?.event_id) return null;

  return safeMaybeSingle(
    supabase
      .from('events')
      .select('id, workspace_id, created_at, metadata, source, is_demo')
      .eq('workspace_id', workspaceId)
      .eq('id', signedContract.event_id)
      .maybeSingle(),
    'events.signed_contract_event'
  );
}

async function collectFacts({ supabase, workspaceId, progress }) {
  const demoEvent = await getDemoEvent({ supabase, workspaceId });
  const demoEventId = demoEvent?.id || null;

  const [templatesResp, eventTypesResp, precontractsResp, signedContractsResp, membersResp, formationTemplatesResp, scaleResp, repertoireResp] = await Promise.all([
    safeCount(supabase.from('contract_templates').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId), 'contract_templates'),
    safeCount(supabase.from('event_types').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId), 'event_types'),
    safeCount(supabase.from('precontracts').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId), 'precontracts'),
    safeCount(supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).in('status', ['signed', 'assinado', 'ASSINADO']), 'contracts.signed'),
    safeCount(supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).in('contact_type', ['musician', 'member', 'team', 'staff']), 'contacts.members'),
    safeCount(supabase.from('scale_templates').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('is_active', true), 'scale_templates'),
    demoEventId
      ? safeCount(supabase.from('event_musicians').select('id', { count: 'exact', head: true }).eq('event_id', demoEventId), 'event_musicians.demo')
      : Promise.resolve({ count: 0 }),
    demoEventId
      ? safeCount(supabase.from('repertoire_config').select('id', { count: 'exact', head: true }).eq('event_id', demoEventId).in('status', ['FINALIZADO', 'CONCLUIDO', 'AGUARDANDO_REVISAO', 'finalizado', 'concluido', 'aguardando_revisao']), 'repertoire_config.submitted')
      : Promise.resolve({ count: 0 }),
  ]);

  const flowState = progress?.flow_state && typeof progress.flow_state === 'object' ? progress.flow_state : {};
  const hasMemberPanelViewed = flowState.hasMemberPanelViewed === true;
  const hasAutomationsViewed = flowState.hasAutomationsViewed === true || progress?.automation_configured === true;
  const hasFinanceViewed = flowState.hasFinanceViewed === true;
  const hasAdminRepertoireViewed = flowState.hasAdminRepertoireViewed === true;
  const hasDashboardDemoViewed = flowState.hasDashboardDemoViewed === true;
  const canCleanupDemoEvent = Boolean(
    demoEventId &&
    isDemoEvent(demoEvent) &&
    hasMemberPanelViewed &&
    hasAutomationsViewed &&
    hasFinanceViewed &&
    hasAdminRepertoireViewed &&
    hasDashboardDemoViewed
  );

  return {
    workspaceId,
    demoEventId,
    hasContractTemplate: progress?.template_created === true || hasCount(templatesResp),
    hasEventType: progress?.event_type_created === true || hasCount(eventTypesResp),
    hasPrecontract: progress?.precontract_created === true || hasCount(precontractsResp),
    hasSignedContract: progress?.contract_signed_test === true || hasCount(signedContractsResp),
    hasClientRepertoireSubmitted: hasCount(repertoireResp),
    hasFakeMembers: progress?.team_configured === true || Number(membersResp?.count || 0) >= 2,
    hasFormationTemplate: hasCount(formationTemplatesResp),
    hasScale: hasCount(scaleResp),
    hasMemberPanelViewed,
    hasAutomationsViewed,
    hasFinanceViewed,
    hasAdminRepertoireViewed,
    hasDashboardDemoViewed,
    canCleanupDemoEvent,
    isComplete: Boolean(progress?.completed_at || flowState.onboardingCompleted === true),
  };
}

export async function GET(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      logPrefix: '[ONBOARDING_FLOW_STATUS][GET]',
    });

    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
    }

    const progress = await ensureProgressRow({ supabase, workspaceId: auth.workspaceId });
    const facts = await collectFacts({ supabase, workspaceId: auth.workspaceId, progress });
    const flow = buildOnboardingFlowStatus(facts);

    return NextResponse.json({
      ok: true,
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
    const auth = await requireWorkspaceAdmin({
      supabase,
      request,
      logPrefix: '[ONBOARDING_FLOW_STATUS][PATCH]',
    });

    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
    }

    const body = await request.json().catch(() => ({}));
    const guide = String(body?.guide || '').trim().toLowerCase();
    const markKey = GUIDE_VIEW_MARKS[guide];
    if (!markKey && body?.completed !== true) {
      return NextResponse.json({ ok: false, error: 'Guia de onboarding inválido.' }, { status: 400 });
    }

    const progress = await ensureProgressRow({ supabase, workspaceId: auth.workspaceId });
    const currentFlowState = progress?.flow_state && typeof progress.flow_state === 'object' ? progress.flow_state : {};
    const nextFlowState = {
      ...currentFlowState,
      ...(markKey ? { [markKey]: true } : {}),
      ...(body?.completed === true ? { onboardingCompleted: true } : {}),
      updatedAt: new Date().toISOString(),
    };

    const { data: updated, error } = await supabase
      .from('workspace_onboarding_progress')
      .update({ flow_state: nextFlowState, updated_at: new Date().toISOString() })
      .eq('workspace_id', auth.workspaceId)
      .select('*')
      .single();
    if (error) throw error;

    const facts = await collectFacts({ supabase, workspaceId: auth.workspaceId, progress: updated });
    const flow = buildOnboardingFlowStatus(facts);

    return NextResponse.json({ ok: true, ...facts, ...flow });
  } catch (error) {
    console.error('[ONBOARDING_FLOW_STATUS][PATCH][ERROR]', { message: error?.message, code: error?.code, details: error?.details });
    return NextResponse.json({ ok: false, error: error?.message || 'Erro ao atualizar status do onboarding.' }, { status: 500 });
  }
}
