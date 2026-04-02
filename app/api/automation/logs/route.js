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
    const source = searchParams.get('source');
    const rule_id = searchParams.get('rule_id');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || DEFAULT_LIMIT, 500) : DEFAULT_LIMIT;

    let query = supabaseAdmin
      .from('automation_logs')
      .select(
        'id, status, recipient_number, rendered_message, source, error_message, created_at, sent_at, recipient_type, rule_id, template_id, channel_id, entity_id, entity_type, metadata, provider_response'
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (recipient) {
      query = query.ilike('recipient_number', `%${recipient}%`);
    }

    if (source) {
      query = query.eq('source', source);
    }

    if (rule_id) {
      query = query.eq('rule_id', rule_id);
    }

    if (date_from) {
      query = query.gte('created_at', date_from);
    }

    if (date_to) {
      // Include the full end day
      const endDate = new Date(date_to);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lt('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ ok: true, logs: data || [] });
  } catch (error) {
    console.error('[GET /api/automation/logs] Erro:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
