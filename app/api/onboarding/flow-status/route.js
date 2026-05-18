import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import { MIN_FAKE_MEMBERS, ONBOARDING_DEMO_NOTE_MARKER } from '@/lib/onboarding/fakeMembers';

const STEP_HREFS = {
  contract_template: '/contratos/templates?guide=template',
  event_type: '/eventos/tipos?guide=event-types',
  precontract: '/pre-contratos?guide=precontract',
  fake_members: '/configuracoes/equipe?guide=fake-members',
  formation_template: '/templates-escala?guide=formation-template',
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

function getNextRequiredStep({ hasContractTemplate, hasEventType, hasPrecontract, hasFakeMembers }) {
  if (!hasContractTemplate) return 'contract_template';
  if (!hasEventType) return 'event_type';
  if (!hasPrecontract) return 'precontract';
  if (!hasFakeMembers) return 'fake_members';
  return 'formation_template';
}

async function countFakeMembers({ supabase, workspaceId }) {
  const baseQuery = () => supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .in('contact_type', ['musician', 'staff']);

  const richResponse = await safeCount(
    baseQuery().or(`notes.ilike.%${ONBOARDING_DEMO_NOTE_MARKER}%,source.eq.onboarding_demo`),
    'fake_members',
  );

  if (!richResponse.error) return richResponse;

  const message = `${richResponse.error?.message || ''} ${richResponse.error?.details || ''} ${richResponse.error?.hint || ''}`;
  if (!/source|schema cache|column/i.test(message)) return richResponse;

  return safeCount(
    baseQuery().ilike('notes', `%${ONBOARDING_DEMO_NOTE_MARKER}%`),
    'fake_members_notes_fallback',
  );
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

    const [templatesResp, eventTypesResp, precontractsResp, fakeMembersResp] = await Promise.all([
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
      countFakeMembers({ supabase, workspaceId: auth.workspaceId }),
    ]);

    const hasContractTemplate = hasCount(templatesResp);
    const hasEventType = hasCount(eventTypesResp);
    const hasPrecontract = hasCount(precontractsResp);
    const fakeMembersCount = Number(fakeMembersResp?.count || 0);
    const hasFakeMembers = fakeMembersCount >= MIN_FAKE_MEMBERS;
    const nextRequiredStep = getNextRequiredStep({ hasContractTemplate, hasEventType, hasPrecontract, hasFakeMembers });
    const nextStep = hasFakeMembers ? 'formation_template' : nextRequiredStep;

    return NextResponse.json({
      ok: true,
      workspaceId: auth.workspaceId,
      hasContractTemplate,
      hasEventType,
      hasPrecontract,
      hasFakeMembers,
      fakeMembersCount,
      minFakeMembers: MIN_FAKE_MEMBERS,
      nextStep,
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
