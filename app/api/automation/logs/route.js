import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getDefaultWorkspaceSettings } from '@/lib/automation/get-workspace';
import { requireAdmin } from '@/lib/api/require-admin';

const DEFAULT_LIMIT = 100;
const AUTOMATION_LOGS_SELECT_FIELDS = [
  'id',
  'workspace_id',
  'status',
  'source',
  'recipient',
  'recipient_number',
  'recipient_type',
  'rule_id',
  'template_id',
  'channel_id',
  'rendered_message',
  'error_message',
  'metadata',
  'provider_response',
  'sent_at',
  'created_at',
].join(', ');
const AUTOMATION_LOGS_FALLBACK_SELECT_FIELDS = [
  'id',
  'workspace_id',
  'status',
  'source',
  'recipient',
  'recipient_number',
  'rule_id',
  'template_id',
  'error_message',
  'sent_at',
  'created_at',
].join(', ');

function isMissingColumnError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();

  return (
    code === '42703' ||
    message.includes('does not exist') ||
    message.includes('could not find the') ||
    details.includes('schema cache')
  );
}

function buildLogsQuery({
  supabaseAdmin,
  workspaceId,
  selectFields,
  ascending,
  limit,
  status,
  recipient,
  ruleId,
  source,
  dateFrom,
  dateTo,
}) {
  let query = supabaseAdmin
    .from('automation_logs')
    .select(selectFields)
    .order('created_at', { ascending })
    .limit(limit);

  query = query.eq('workspace_id', workspaceId);

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

  return query;
}

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

    let selectFields = AUTOMATION_LOGS_SELECT_FIELDS;
    let { data, error } = await buildLogsQuery({
      supabaseAdmin,
      workspaceId: workspace.id,
      selectFields,
      ascending,
      limit,
      status,
      recipient,
      ruleId,
      source,
      dateFrom,
      dateTo,
    });

    if (error && isMissingColumnError(error)) {
      console.warn('[GET /api/automation/logs] Coluna ausente detectada; aplicando fallback de select', {
        message: error?.message || null,
        code: error?.code || null,
      });

      selectFields = AUTOMATION_LOGS_FALLBACK_SELECT_FIELDS;
      ({ data, error } = await buildLogsQuery({
        supabaseAdmin,
        workspaceId: workspace.id,
        selectFields,
        ascending,
        limit,
        status,
        recipient,
        ruleId,
        source,
        dateFrom,
        dateTo,
      }));
    }

    if (error) {
      console.error('[GET /api/automation/logs] Supabase error:', error);
      throw error;
    }

    if (process.env.NODE_ENV !== 'production') {
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
          fallback: selectFields !== AUTOMATION_LOGS_SELECT_FIELDS,
        },
        count: data?.length || 0,
      });
    }

    const logs = data || [];
    return NextResponse.json({
      ok: true,
      data: { logs },
      logs,
    });
  } catch (error) {
    console.error('[GET /api/automation/logs] Erro:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const auth = await requireAdmin({ supabase: supabaseAdmin, request, logPrefix: '[AUTOMATION_LOGS_DELETE]' });
    if (!auth.ok) return NextResponse.json(auth, { status: auth.status || 401 });

    const workspace = await getDefaultWorkspaceSettings();
    const body = await request.json().catch(() => ({}));

    const ids = Array.from(
      new Set(
        [
          ...(Array.isArray(body?.ids) ? body.ids : []),
          ...(Array.isArray(body?.logIds) ? body.logIds : []),
        ]
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      )
    );
    const mode = String(body?.mode || '').trim();
    const statusFilter = normalizeStatusFilter(body?.status);
    const olderThanDays = Number(body?.olderThanDays || 0);

    let query = supabaseAdmin.from('automation_logs').delete().eq('workspace_id', workspace.id);

    if (ids.length > 0) {
      query = query.in('id', ids);
    } else if (mode === 'cleanup') {
      if (olderThanDays > 0) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - olderThanDays);
        query = query.lt('created_at', cutoff.toISOString());
      }
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }
    } else {
      return NextResponse.json(
        { ok: false, success: false, affected: 0, message: 'Informe ids ou filtro de limpeza.' },
        { status: 400 }
      );
    }

    const { data, error } = await query.select('id');
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      success: true,
      affected: Array.isArray(data) ? data.length : 0,
    });
  } catch (error) {
    console.error('[AUTOMATION_LOGS_DELETE][ERROR]', error);
    return NextResponse.json(
      { ok: false, success: false, affected: 0, message: error?.message || 'Erro ao excluir logs.' },
      { status: 500 }
    );
  }
}
