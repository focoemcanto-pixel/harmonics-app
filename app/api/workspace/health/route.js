import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';
import { calculateWorkspaceHealth } from '@/lib/workspace-events/calculateWorkspaceHealth';

export async function GET(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAdmin({
      supabase,
      request,
      logPrefix: '[WORKSPACE_HEALTH_API]',
    });

    if (!auth.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: auth.error,
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

    const health = calculateWorkspaceHealth(data || []);

    return NextResponse.json({
      ok: true,
      workspaceId: auth.workspaceId,
      health,
    });
  } catch (error) {
    console.error('[WORKSPACE_HEALTH_API][GET][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Erro ao calcular saúde operacional do workspace.',
      },
      { status: 500 },
    );
  }
}
