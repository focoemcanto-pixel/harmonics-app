import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import { getNextOnboardingStep } from '@/lib/onboarding/getNextOnboardingStep';

export async function GET(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      logPrefix: '[ONBOARDING_NEXT_STEP]',
    });

    if (!auth.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: auth.error,
        },
        {
          status: auth.status || 401,
        },
      );
    }

    const { data, error } = await supabase
      .from('workspace_onboarding_progress')
      .select('*')
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    if (error) throw error;

    const onboarding = getNextOnboardingStep(data || {});

    return NextResponse.json({
      ok: true,
      workspaceId: auth.workspaceId,
      ...onboarding,
    });
  } catch (error) {
    console.error('[ONBOARDING_NEXT_STEP][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Erro ao carregar próxima etapa do onboarding.',
      },
      {
        status: 500,
      },
    );
  }
}
