import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PROTECTED_WORKSPACE_KEYS = new Set(['default', 'harmonics-producao', 'production', 'prod']);
const PROTECTED_WORKSPACE_NAMES = new Set(['harmonics / produção atual', 'workspace padrão']);

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function isMissingTableOrColumn(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();

  return (
    code === '42p01' ||
    code === '42703' ||
    message.includes('does not exist') ||
    message.includes('could not find') ||
    details.includes('schema cache')
  );
}

async function safeDelete(queryBuilder, label, report) {
  const { error, count } = await queryBuilder;

  if (error) {
    if (isMissingTableOrColumn(error)) {
      report.skipped.push({ label, reason: error.message });
      return;
    }

    throw error;
  }

  report.deleted.push({ label, count: Number(count || 0) });
}

async function safeSelectIds(queryBuilder) {
  const { data, error } = await queryBuilder;
  if (error) {
    if (isMissingTableOrColumn(error)) return [];
    throw error;
  }
  return (data || []).map((item) => item?.id).filter(Boolean);
}

function assertWorkspaceCanBeDeleted(workspace) {
  const key = normalize(workspace?.key || workspace?.slug);
  const slug = normalize(workspace?.slug);
  const name = normalize(workspace?.name);

  if (PROTECTED_WORKSPACE_KEYS.has(key) || PROTECTED_WORKSPACE_KEYS.has(slug) || PROTECTED_WORKSPACE_NAMES.has(name)) {
    return 'Este workspace é protegido e não pode ser excluído por esta ação.';
  }

  return null;
}

export async function DELETE(request) {
  const supabase = getSupabaseAdmin();
  const auth = await requireWorkspaceAdmin({
    supabase,
    request,
    logPrefix: '[WORKSPACE_DELETE]',
  });

  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
  }

  try {
    if (auth.role !== 'owner') {
      return NextResponse.json(
        { ok: false, error: 'Apenas o owner pode excluir o workspace.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const confirmation = String(body?.confirmation || '').trim();

    if (confirmation !== 'DELETE') {
      return NextResponse.json(
        { ok: false, error: 'Digite DELETE para confirmar a exclusão.' },
        { status: 400 }
      );
    }

    const workspaceId = auth.workspaceId;
    const workspace = auth.workspace || null;
    const protectionError = assertWorkspaceCanBeDeleted(workspace);

    if (protectionError) {
      return NextResponse.json({ ok: false, error: protectionError }, { status: 409 });
    }

    const report = { deleted: [], skipped: [] };

    const eventIds = await safeSelectIds(
      supabase.from('events').select('id').eq('workspace_id', workspaceId)
    );

    if (eventIds.length > 0) {
      await safeDelete(supabase.from('invites').delete({ count: 'exact' }).in('event_id', eventIds), 'invites', report);
      await safeDelete(supabase.from('event_musicians').delete({ count: 'exact' }).in('event_id', eventIds), 'event_musicians', report);
      await safeDelete(supabase.from('repertoire_items').delete({ count: 'exact' }).in('event_id', eventIds), 'repertoire_items', report);
      await safeDelete(supabase.from('repertoire_tokens').delete({ count: 'exact' }).in('event_id', eventIds), 'repertoire_tokens', report);
      await safeDelete(supabase.from('repertoire_config').delete({ count: 'exact' }).in('event_id', eventIds), 'repertoire_config', report);
      await safeDelete(supabase.from('payments').delete({ count: 'exact' }).in('event_id', eventIds), 'payments_by_event', report);
      await safeDelete(supabase.from('contracts').delete({ count: 'exact' }).in('event_id', eventIds), 'contracts_by_event', report);
      await safeDelete(supabase.from('precontracts').delete({ count: 'exact' }).in('event_id', eventIds), 'precontracts_by_event', report);
    }

    const workspaceScopedTables = [
      'automation_logs',
      'automation_rules',
      'message_templates',
      'whatsapp_channels',
      'contacts',
      'workspace_usage_counters',
      'workspace_subscriptions',
      'workspace_settings',
      'workspace_members',
      'events',
    ];

    for (const table of workspaceScopedTables) {
      await safeDelete(
        supabase.from(table).delete({ count: 'exact' }).eq('workspace_id', workspaceId),
        table,
        report
      );
    }

    await safeDelete(
      supabase.from('workspaces').delete({ count: 'exact' }).eq('id', workspaceId),
      'workspaces',
      report
    );

    return NextResponse.json({
      ok: true,
      deletedWorkspaceId: workspaceId,
      report,
      next: '/signup?workspace=deleted',
    });
  } catch (error) {
    console.error('[WORKSPACE_DELETE][ERROR]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao excluir workspace.' },
      { status: 500 }
    );
  }
}
