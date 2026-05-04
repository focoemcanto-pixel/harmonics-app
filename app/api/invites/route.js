import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import { getCurrentWorkspace } from '@/lib/workspaces/get-current-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const INVITES_SELECT = `
  id,
  workspace_id,
  event_id,
  contact_id,
  role_id,
  suggested_role_name,
  status,
  sent_at,
  responded_at,
  created_at
`;

export async function GET(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireAdmin({ supabase, request });
    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.error }, { status: 401 });
    }

    const { workspaceId } = await getCurrentWorkspace({ supabase });

    const { data, error } = await supabase
      .from('invites')
      .select(INVITES_SELECT)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      data: data || [],
      workspaceId,
    });

  } catch (error) {
    console.error('[INVITES_API][GET]', error);

    return NextResponse.json({
      ok: false,
      message: error?.message || 'Erro ao carregar convites'
    }, { status: 500 });
  }
}
