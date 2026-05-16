import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';

const STEP_HREFS = {
  contract_template: '/contratos/templates?guide=template',
  event_type: '/eventos/tipos?guide=event-types',
  precontract: '/pre-contratos?guide=precontract',
  done: '/dashboard',
};

function hasCount(response) {
  return Number(response?.count || 0) > 0;
}

async function safeCount(queryPromise, label) {
  try {
    return await queryPromise;
  } catch (error) {
    console.warn('[ONBOARDING_FLOW_STATUS][COUNT_ERROR]', {
      label,
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });
    return { count: 0, error };
  }
}

function getNextRequiredStep({ hasContractTemplate, hasEventType, hasPrecontract }) {
  if (!hasContractTemplate) return 'contract_template';
  if (!hasEventType) return 'event_type';
  if (!hasPrecontract) return 'precontract';
  return 'done';
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
      return NextResponse.json(
        { ok: false, error: auth.error },
        { status: auth.status || 401 },
      );
    }

    const [templatesResp, eventTypesResp, precontractsResp] = await Promise.all([
      safeCount(
        supabase
          .from('contract_templates')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', auth.workspaceId),
        'contract_templates',
      ),
      safeCount(
        supabase
          .from('event_types')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', auth.workspaceId),
        'event_types',
      ),
      safeCount(
        supabase
          .from('precontracts')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', auth.workspaceId),
        'precontracts',
      ),
    ]);

    const hasContractTemplate = hasCount(templatesResp);
    const hasEventType = hasCount(eventTypesResp);
    const hasPrecontract = hasCount(precontractsResp);
    const nextRequiredStep = getNextRequiredStep({ hasContractTemplate, hasEventType, hasPrecontract });

    return NextResponse.json({
      ok: true,
      workspaceId: auth.workspaceId,
      hasContractTemplate,
      hasEventType,
      hasPrecontract,
      nextRequiredStep,
      nextHref: STEP_HREFS[nextRequiredStep],
    });
  } catch (error) {
    console.error('[ONBOARDING_FLOW_STATUS][GET][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao carregar status do onboarding.' },
      { status: 500 },
    );
  }
}
