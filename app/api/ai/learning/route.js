import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][LEARNING]' });
  if (!guard.ok) return guard.response;
  const status = new URL(request.url).searchParams.get('status') || 'pending';
  const { data, error } = await guard.supabase.from('ai_learning_suggestions').select('*')
    .eq('workspace_id', guard.auth.workspaceId).eq('status', status)
    .order('occurrences', { ascending: false }).order('updated_at', { ascending: false }).limit(100);
  if (error) return NextResponse.json({ ok: false, error: 'Falha ao carregar.' }, { status: 500 });
  return NextResponse.json({ ok: true, suggestions: data || [] });
}
