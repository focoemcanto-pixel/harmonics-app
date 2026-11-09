import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][PRICING_PROPOSALS]' });
  if (!guard.ok) return guard.response;
  const status = new URL(request.url).searchParams.get('status') || 'pending';
  const { data } = await guard.supabase.from('ai_pricing_proposals').select('*').eq('workspace_id', guard.auth.workspaceId).eq('status', status).order('category').order('item_key').limit(500);
  return NextResponse.json({ ok: true, proposals: data || [] });
}
