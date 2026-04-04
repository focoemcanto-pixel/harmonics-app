import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getDefaultWorkspace } from '@/lib/automation/get-workspace';

const DEFAULT_LIMIT = 100;

export async function GET(request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const workspaceId = await getDefaultWorkspace();

    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const recipient = searchParams.get('recipient');
    const ruleId = searchParams.get('rule_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const sortParam = searchParams.get('sort');

    const ascending = sortParam === 'asc';

    const limitParam = Number(searchParams.get('limit') || DEFAULT_LIMIT);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 500)
      : DEFAULT_LIMIT;

    let query = supabaseAdmin
      .from('automation_logs')
      .select('*')
      .order('created_at', { ascending })
      .limit(limit);

    // Se você tiver certeza que automation_logs tem workspace_id, mantenha isso.
    // Se der erro mesmo depois dessa correção, comente este bloco temporariamente.
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (recipient) {
      query = query.ilike('recipient_number', `%${recipient}%`);
    }

    if (ruleId) {
      query = query.eq('rule_id', ruleId);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lt('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('[GET /api/automation/logs] Supabase error:', error);
      throw error;
    }

    return NextResponse.json({
      ok: true,
      logs: data || [],
    });
  } catch (error) {
    console.error('[GET /api/automation/logs] Erro:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
