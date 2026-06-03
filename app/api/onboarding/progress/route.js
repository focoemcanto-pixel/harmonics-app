import { NextResponse } from 'next/server';
import { ONBOARDING_FLOW_STEPS } from '@/lib/onboarding/onboarding-flow';
import { calculateOnboardingFlowProgress } from '@/lib/onboarding/getNextOnboardingStep';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LEGACY_STEPS = [
  {
    key: 'workspace_configured',
    title: 'Configure o workspace',
    description: 'Defina a base inicial do workspace.',
    href: '/dashboard?onboarding=fresh-workspace',
    cta: 'Configurar workspace',
  },
  {
    key: 'template_created',
    title: 'Crie o primeiro template de contrato',
    description: 'Monte o texto base do contrato com tags dinâmicas.',
    href: '/contratos/templates?guide=template',
    cta: 'Criar template',
  },
  {
    key: 'event_type_created',
    title: 'Associe templates aos tipos de evento',
    description: 'Vincule o tipo de evento ao template correto.',
    href: '/eventos/tipos?guide=event-types',
    cta: 'Configurar tipos',
  },
  {
    key: 'precontract_created',
    title: 'Gere o primeiro pré-contrato',
    description: 'Gere o link comercial para o cliente preencher e assinar.',
    href: '/pre-contratos?guide=precontract',
    cta: 'Criar pré-contrato',
  },
  {
    key: 'contract_signed_test',
    title: 'Simule a experiência do cliente',
    description: 'Abra o link externo, assine e valide a experiência.',
    href: '/pre-contratos?guide=precontract',
    cta: 'Simular contrato',
  },
  {
    key: 'first_event_created',
    title: 'Crie uma escala operacional',
    description: 'Monte a primeira escala do evento demo.',
    href: '/eventos?guide=scale-with-formation',
    cta: 'Criar escala',
  },
  {
    key: 'automation_configured',
    title: 'Configure automações',
    description: 'Prepare canais, mensagens e logs de envio.',
    href: '/automacoes?guide=automation-overview',
    cta: 'Configurar automações',
  },
  {
    key: 'team_configured',
    title: 'Adicione sua equipe',
    description: 'Convide membros e defina funções dentro do workspace.',
    href: '/configuracoes/equipe?guide=fake-members',
    cta: 'Adicionar equipe',
  },
];

const LEGACY_STEP_TO_GUIDE = {
  workspace_configured: 'dashboard-demo',
  template_created: 'template',
  event_type_created: 'event-types',
  precontract_created: 'precontract',
  contract_signed_test: 'client-contract-success',
  first_event_created: 'scale-with-formation',
  automation_configured: 'automation-overview',
  team_configured: 'fake-members',
};

const LEGACY_STEP_TO_FLOW_STATE = {
  workspace_configured: 'workspace_created_for_onboarding',
  template_created: 'contract_template_completed',
  contract_signed_test: 'client_contract_signed',
};

function getOrigin(request) {
  const urlOrigin = new URL(request.url).origin;
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (forwardedProto && forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return urlOrigin;
}

function forwardHeaders(request) {
  const headers = new Headers();
  const authorization = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');
  if (authorization) headers.set('authorization', authorization);
  if (cookie) headers.set('cookie', cookie);
  headers.set('accept', 'application/json');
  return headers;
}

async function callFlowStatus(request, { method = 'GET', body = null } = {}) {
  const headers = forwardHeaders(request);
  if (body) headers.set('content-type', 'application/json');

  const response = await fetch(`${getOrigin(request)}/api/onboarding/flow-status`, {
    method,
    headers,
    cache: 'no-store',
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  return { response, payload };
}

function buildLegacyProgress(flowPayload = {}) {
  const flowState = flowPayload.flow_state || flowPayload.progress?.flow_state || {};
  const completedAt = flowPayload.progress?.completed_at || null;
  const skipped = flowPayload.skipped === true || flowState.skipped === true || flowState.onboarding_skipped === true;
  const completed = flowPayload.completed === true || flowState.onboarding_completed === true || flowState.onboardingCompleted === true;

  return {
    ...(flowPayload.progress || {}),
    workspace_configured: completed || skipped || flowPayload.onboardingEnabled === true || flowPayload.primaryWorkspace === true,
    template_created: completed || skipped || flowPayload.hasContractTemplate === true,
    event_type_created: completed || skipped || flowPayload.hasEventType === true,
    precontract_created: completed || skipped || flowPayload.hasPrecontract === true,
    contract_signed_test: completed || skipped || flowPayload.hasSignedContract === true,
    first_event_created: completed || skipped || flowPayload.hasScale === true || Boolean(flowPayload.demoEventId),
    automation_configured: completed || skipped || flowPayload.hasAutomationsViewed === true,
    team_configured: completed || skipped || flowPayload.hasFakeMembers === true,
    completed_at: completed || skipped ? completedAt || new Date().toISOString() : completedAt,
    flow_state: flowState,
  };
}

function buildLegacySummary(progress = {}) {
  const total = LEGACY_STEPS.length;
  const completed = LEGACY_STEPS.filter((step) => progress?.[step.key] === true).length;
  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

function toLegacyResponse(flowPayload = {}) {
  const progress = buildLegacyProgress(flowPayload);
  const summary = buildLegacySummary(progress);
  const flowSummary = calculateOnboardingFlowProgress(flowPayload);
  const flowSteps = ONBOARDING_FLOW_STEPS.filter((step) => step.key !== 'complete');

  return {
    ok: flowPayload.ok !== false,
    workspaceId: flowPayload.workspaceId,
    showOnboarding: flowPayload.primaryWorkspace === true ? false : flowPayload.completed !== true && flowPayload.skipped !== true,
    progress,
    summary,
    steps: LEGACY_STEPS,
    flow: {
      ...flowPayload,
      summary: flowSummary,
      steps: flowSteps,
    },
  };
}

function legacyPatchBody(body = {}) {
  if (body?.skipOnboarding === true) {
    return {
      flowState: { skipped: true, onboarding_skipped: true },
      completed: true,
    };
  }

  const stepKey = String(body?.stepKey || '').trim();
  const completed = body?.completed !== false;
  const guide = LEGACY_STEP_TO_GUIDE[stepKey] || stepKey;
  const flowStateKey = completed ? LEGACY_STEP_TO_FLOW_STATE[stepKey] : null;

  return {
    guide,
    ...(flowStateKey ? { flowState: { [flowStateKey]: true } } : {}),
  };
}

export async function GET(request) {
  try {
    const { response, payload } = await callFlowStatus(request);
    if (!response.ok || payload?.ok === false) {
      return NextResponse.json(payload || { ok: false, error: 'Erro ao carregar onboarding.' }, { status: response.status || 500 });
    }

    return NextResponse.json(toLegacyResponse(payload));
  } catch (error) {
    console.error('[ONBOARDING_PROGRESS_COMPAT][GET][ERROR]', {
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
  try {
    const body = await request.json().catch(() => ({}));
    const patchBody = legacyPatchBody(body);

    if (!patchBody.guide && !patchBody.completed && !patchBody.flowState) {
      return NextResponse.json({ ok: false, error: 'Etapa de onboarding inválida.' }, { status: 400 });
    }

    const { response, payload } = await callFlowStatus(request, {
      method: 'PATCH',
      body: patchBody,
    });

    if (!response.ok || payload?.ok === false) {
      return NextResponse.json(payload || { ok: false, error: 'Erro ao atualizar onboarding.' }, { status: response.status || 500 });
    }

    return NextResponse.json(toLegacyResponse(payload));
  } catch (error) {
    console.error('[ONBOARDING_PROGRESS_COMPAT][PATCH][ERROR]', {
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
