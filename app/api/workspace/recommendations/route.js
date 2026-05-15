import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';
import { calculateWorkspaceHealth } from '@/lib/workspace-events/calculateWorkspaceHealth';
import { getWorkspaceRecommendations } from '@/lib/workspace-recommendations/getWorkspaceRecommendations';

export async function GET(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      moduleKey: 'dashboard',
      actionKey: 'read',
      logPrefix: '[WORKSPACE_RECOMMENDATIONS_API]',
      allowedRoles: ['owner', 'admin', 'financeiro', 'operacional', 'editor', 'viewer'],
    });

    if (!auth.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: auth.error || 'Acesso não autorizado.',
        },
        { status: auth.status || 401 },
      );
    }

    const { data, error } = await supabase
      .from('workspace_activity_events')
      .select('id, type, metadata, created_at')
      .eq('workspace_id', auth.workspaceId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      throw error;
    }

    const events = data || [];
    const health = calculateWorkspaceHealth(events);
    const recommendations = getWorkspaceRecommendations(events, health);

    return NextResponse.json({
      ok: true,
      workspaceId: auth.workspaceId,
      recommendations,
      total: recommendations.length,
      health,
    });
  } catch (error) {
    console.error('[WORKSPACE_RECOMMENDATIONS_API][GET][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Erro ao carregar recomendações do workspace.',
      },
      { status: 500 },
    );
  }
}
