import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { decideSuggestion } from '@/lib/ai/commercial/learning.mjs';
import { clearKnowledgeCache } from '@/lib/ai/commercial/engine.mjs';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][LEARNING][DECIDE]' });
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!['approved', 'rejected'].includes(body?.decision)) return NextResponse.json({ ok: false, error: 'Decisão inválida.' }, { status: 400 });
  const result = await decideSuggestion({
    supabase: guard.supabase, workspaceId: guard.auth.workspaceId, suggestionId: id, decision: body.decision,
    actor: guard.auth.userId, edit: { kind: body.kind, title: body.title, content: body.content, intents: body.intents },
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: 'Sugestão indisponível.' }, { status: 404 });
  clearKnowledgeCache();
  return NextResponse.json(result);
}
