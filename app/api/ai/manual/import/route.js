import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { importManual } from '@/lib/ai/commercial/manual-import.mjs';

export const dynamic = 'force-dynamic';

// Importa o Manual Mestre (Markdown): tudo vira sugestão/proposta PENDENTE. dry_run=true só mostra a prévia.
export async function POST(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][MANUAL_IMPORT]' });
  if (!guard.ok) return guard.response;
  const body = await request.json().catch(() => ({}));
  const markdown = typeof body?.markdown === 'string' ? body.markdown : '';
  if (markdown.length < 200 || markdown.length > 400_000) return NextResponse.json({ ok: false, error: 'Envie o Markdown do manual (200 a 400.000 caracteres).' }, { status: 400 });
  const version = /^v[\d.]+$/.test(String(body?.version || '')) ? body.version : 'v2.1';
  const result = await importManual({ supabase: guard.supabase, workspaceId: guard.auth.workspaceId, markdown, actor: guard.auth.userId, dryRun: body?.dry_run !== false, version });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
