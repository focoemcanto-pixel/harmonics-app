import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][READ]' });
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const { error } = await guard.supabase.from('ai_conversations').update({ unread_count: 0 })
    .eq('id', id).eq('workspace_id', guard.auth.workspaceId);
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
