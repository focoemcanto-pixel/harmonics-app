import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { buildQueues } from '@/lib/ai/commercial/queues.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][QUEUES]' });
  if (!guard.ok) return guard.response;
  return NextResponse.json({ ok: true, ...(await buildQueues({ supabase: guard.supabase, workspaceId: guard.auth.workspaceId })) });
}
