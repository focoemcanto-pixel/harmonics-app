import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import { getCurrentWorkspace } from '@/lib/workspaces/get-current-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  const supabase = getSupabaseAdmin();

  try {
    const auth = await requireAdmin({ supabase, request });
    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.error }, { status: 401 });
    }

    const { workspaceId } = await getCurrentWorkspace({ supabase });

    // ⚠️ aqui está o pulo do gato
    const { data, error } = await supabase
      .from('event_musicians')
      .select(`
        *,
        events!inner(id, workspace_id)
      `)
      .eq('events.workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      data: data || []
    });

  } catch (error) {
    console.error('[EVENT_MUSICIANS_API]', error);

    return NextResponse.json({
      ok: false,
      message: error?.message || 'Erro ao carregar convites'
    }, { status: 500 });
  }
}
