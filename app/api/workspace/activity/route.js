import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';
import { presentWorkspaceEvent } from '@/lib/workspace-events/presentWorkspaceEvent';

function normalizeLimit(value) {
  const parsed = Number.parseInt(String(value || '20'), 10);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(Math.max(parsed, 1), 100);
}

export async function GET(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireWorkspaceAdmin({
      supabase,
      request,
      logPrefix: '[WORKSPACE_ACTIVITY_API]',
    });

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: auth.error },
        { status: auth.status || 401 },
      );
    }

    const { searchParams } = new URL(request.url);

    const limit = normalizeLimit(searchParams.get('limit'));
    const typeFilter = String(searchParams.get('type') || '').trim();

    let query = supabase
      .from('workspace_activity_events')
      .select('id, workspace_id, type, metadata, created_at')
      .eq('workspace_id', auth.workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (typeFilter) {
      query = query.eq('type', typeFilter);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const timeline = (data || []).map((event) => presentWorkspaceEvent(event));

    return NextResponse.json({
      ok: true,
      timeline,
      total: timeline.length,
      workspaceId: auth.workspaceId,
    });
  } catch (error) {
    console.error('[WORKSPACE_ACTIVITY_API][GET][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Erro ao carregar timeline do workspace.',
      },
      { status: 500 },
    );
  }
}
