import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { bootstrapKnowledge } from '@/lib/ai/commercial/bootstrap.mjs';

export const dynamic = 'force-dynamic';

// GET: prévia (nada é gravado). POST: cria SUGESTÕES pendentes (nunca ativa nada).
export async function GET(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][BOOTSTRAP][PREVIEW]' });
  if (!guard.ok) return guard.response;
  const result = await bootstrapKnowledge({ supabase: guard.supabase, workspaceId: guard.auth.workspaceId, dryRun: true });
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][BOOTSTRAP]' });
  if (!guard.ok) return guard.response;
  const result = await bootstrapKnowledge({ supabase: guard.supabase, workspaceId: guard.auth.workspaceId, actor: guard.auth.userId, dryRun: false });
  console.info('[AI][BOOTSTRAP]', { created: result.created.length, skipped: result.skipped.length });
  return NextResponse.json({ ok: true, ...result });
}
