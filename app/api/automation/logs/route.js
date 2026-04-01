import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getDefaultWorkspace } from '@/lib/automation/get-workspace';

const MAX_LOGS = 100;

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const workspaceId = await getDefaultWorkspace();

    let query = supabaseAdmin
      .from('automation_logs')
      .select(
        'id, status, recipient_number, rendered_message, source, error_message, created_at, sent_at, recipient_type'
      )
      .order('created_at', { ascending: false })
      .limit(MAX_LOGS);

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
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
