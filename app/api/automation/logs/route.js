import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentAutomationWorkspaceSettings } from '@/lib/automation/get-workspace';
import { requireAdmin } from '@/lib/api/require-admin';

const DEFAULT_LIMIT = 100;
const VALID_STATUS_FILTERS = new Set(['sent', 'failed', 'skipped']);
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

function asUuidOrNull(value) {
  const raw = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)
    ? raw
    : null;
}

function uniqueWorkspaceIds(...values) {
  return Array.from(new Set(values.map(asUuidOrNull).filter(Boolean)));
}

function scopeWorkspace(query, workspaceIds) {
  const ids = Array.isArray(workspaceIds) ? workspaceIds : uniqueWorkspaceIds(workspaceIds);
  if (ids.length === 0) return query;
  return ids.length === 1 ? query.eq('workspace_id', ids[0]) : query.in('workspace_id', ids);
}

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

function normalizeRecipientFilter(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const digits = raw.replace(/\D/g, '');
  if (digits) return digits.slice(0, 20);

  return raw
    .replace(/[%,()]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

function normalizeDateFilter(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';

  return raw;
}

function buildLogsQuery({
  supabaseAdmin,
  workspaceIds,
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

  query = scopeWorkspace(query, workspaceIds);

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
  return VALID_STATUS_FILTERS.has(value) ? value : '';
}

async function resolveWorkspaceForLogs({ supabaseAdmin, request }) {
  const workspace = await getCurrentAutomationWorkspaceSettings({ supabase: supabaseAdmin, request });
  const workspaceId = asUuidOrNull(workspace?.workspaceId || workspace?.workspace_id || workspace?.id);
  const workspaceSettingsId = asUuidOrNull(workspace?.workspaceSettingsId || workspace?.workspace_settings_id);
  const workspaceIds = uniqueWorkspaceIds(workspaceId, workspaceSettingsId);
  const migrationMode = Boolean(workspace?.migrationMode) || !workspaceId;

  return {
    workspace,
    workspaceId,
    workspaceSettingsId,
    workspaceIds,
    workspaceDebug: {
      workspaceId,
      workspaceSettingsId,
      workspaceIds,
      rawWorkspaceId: workspace?.id || null,
      source: workspace?.source || null,
      migrationMode,
    },
  };
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
}

function normalizeLogForResponse(log) {
  const providerResponse = log?.provider_response || null;
  const metadata = log?.metadata || null;
  const provider = firstNonEmpty(
    log?.provider,
    providerResponse?.provider,
    providerResponse?.providerError?.provider,
    metadata?.provider,
    metadata?.providerError?.provider
  );
  const endpoint = firstNonEmpty(
    log?.endpoint,
    providerResponse?.endpoint,
    providerResponse?.providerEndpoint,
    providerResponse?.providerError?.endpoint,
    metadata?.endpoint,
    metadata?.providerEndpoint,
    metadata?.providerError?.endpoint
  );

  return {
    ...log,
    provider,
    endpoint,
  };
}

export async function GET(request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { workspaceIds, workspaceDebug } = await resolveWorkspaceForLogs({ supabaseAdmin, request });

    if (workspaceIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Workspace de automação não resolvido.', workspace_debug: workspaceDebug },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);

    const status = normalizeStatusFilter(searchParams.get('status'));
    const recipient = normalizeRecipientFilter(searchParams.get('recipient'));
    const ruleId = asUuidOrNull(searchParams.get('rule_id'));
    const dateFrom = normalizeDateFilter(searchParams.get('date_from'));
    const dateTo = normalizeDateFilter(searchParams.get('date_to'));
    const sortParam = searchParams.get('sort');
    const source = String(searchParams.get('source') || '').trim().slice(0, 120);

    const ascending = sortParam === 'asc';

    const limitParam = Number(searchParams.get('limit') || DEFAULT_LIMIT);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 500)
      : DEFAULT_LIMIT;

    let selectFields = AUTOMATION_LOGS_SELECT_FIELDS;
    let { data, error } = await buildLogsQuery({
      supabaseAdmin,
      workspaceIds,
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
        workspaceIds,
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

    const logs = (data || []).map(normalizeLogForResponse);
    return NextResponse.json({
      ok: true,
      data: { logs },
      logs,
      workspace_debug: workspaceDebug,
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

    const { workspaceId, workspaceIds } = await resolveWorkspaceForLogs({ supabaseAdmin, request });
    const body = await request.json().catch(() => ({}));

    if (!workspaceId || workspaceIds.length === 0) {
      return NextResponse.json(
        { ok: false, success: false, affected: 0, message: 'Workspace de automação não resolvido. Exclusão bloqueada em modo migração.' },
        { status: 400 }
      );
    }

    const ids = Array.from(
      new Set(
        [
          ...(Array.isArray(body?.ids) ? body.ids : []),
          ...(Array.isArray(body?.logIds) ? body.logIds : []),
        ]
          .map(asUuidOrNull)
          .filter(Boolean)
      )
    );
    const mode = String(body?.mode || '').trim();
    const statusFilter = normalizeStatusFilter(body?.status);
    const olderThanDays = Number(body?.olderThanDays || 0);

    let query = scopeWorkspace(supabaseAdmin.from('automation_logs').delete(), workspaceIds);

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
