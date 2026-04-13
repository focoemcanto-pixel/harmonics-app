import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getDefaultWorkspaceSettings } from '@/lib/automation/get-workspace';

const DEFAULT_LIMIT = 100;

function normalizeStatusFilter(rawStatus) {
  const value = String(rawStatus || '').toLowerCase().trim();
  if (!value || value === 'all' || value === 'todos') return '';
  if (value === 'success') return 'sent';
  if (value === 'error' || value === 'failure') return 'failed';
  if (value === 'ignored') return 'skipped';
  return value;
}

export async function GET(request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const workspace = await getDefaultWorkspaceSettings();

    const { searchParams } = new URL(request.url);

    const status = normalizeStatusFilter(searchParams.get('status'));
    const recipient = searchParams.get('recipient');
    const ruleId = searchParams.get('rule_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const sortParam = searchParams.get('sort');
    const source = searchParams.get('source');

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

    query = query.eq('workspace_id', workspace.id);

    if (status) {
      query = query.eq('status', status);
    }

    if (recipient) {
      query = query.or(
        `recipient_number.ilike.%${recipient}%,recipient.ilike.%${recipient}%`
      );
    }

    if (ruleId) {
      query = query.eq('rule_id', ruleId);
    }

    if (source) {
      query = query.eq('source', source);
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
    console.log('[logs] query result:', data?.length || 0);

    if (error) {
      console.error('[GET /api/automation/logs] Supabase error:', error);
      throw error;
    }

    console.info('[GET /api/automation/logs] logs_loaded', {
      workspaceId: workspace.id,
      filters: {
        status: status || null,
        recipient: recipient || null,
        ruleId: ruleId || null,
        source: source || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        sort: sortParam || 'desc',
        limit,
      },
      count: data?.length || 0,
    });

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
