import { NextResponse } from 'next/server';
import { guardWorkspaceMember } from '@/lib/api/route-guards';
import { listConversations, getInboxCounters } from '@/lib/ai/inbox/inbox-queries.mjs';

export const dynamic = 'force-dynamic';

// Lista do Inbox + contadores. `updated_after` permite polling incremental (tempo real).
export async function GET(request) {
  const guard = await guardWorkspaceMember(request, { logPrefix: '[AI][INBOX][LIST]' });
  if (!guard.ok) return guard.response;
  const { searchParams } = new URL(request.url);
  const workspaceId = guard.auth.workspaceId;
  const [{ data, error }, counters] = await Promise.all([
    listConversations({
      supabase: guard.supabase,
      workspaceId,
      filter: searchParams.get('filter') || 'all',
      search: searchParams.get('q') || '',
      updatedAfter: searchParams.get('updated_after') || null,
    }),
    getInboxCounters({ supabase: guard.supabase, workspaceId }),
  ]);
  if (error) {
    console.error('[AI][INBOX][LIST][ERROR]', { code: error.code });
    return NextResponse.json({ ok: false, error: 'Inbox indisponível.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, conversations: data || [], counters, server_time: new Date().toISOString() });
}
