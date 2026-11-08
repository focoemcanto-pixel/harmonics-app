import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { parseKnowledgeInput } from '@/lib/ai/commercial/admin-input.mjs';
import { detectConflicts } from '@/lib/ai/commercial/knowledge.mjs';

export const dynamic = 'force-dynamic';

// Conhecimento versionado. Toda criação/edição gera nova versão PENDENTE de aprovação.
export async function GET(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][KNOWLEDGE]' });
  if (!guard.ok) return guard.response;
  const { data, error } = await guard.supabase.from('ai_knowledge_items').select('*')
    .eq('workspace_id', guard.auth.workspaceId).order('item_key').order('version', { ascending: false }).limit(500);
  if (error) return NextResponse.json({ ok: false, error: 'Falha ao carregar.' }, { status: 500 });
  return NextResponse.json({ ok: true, items: data || [] });
}

export async function POST(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][KNOWLEDGE][POST]' });
  if (!guard.ok) return guard.response;
  const input = parseKnowledgeInput(await request.json().catch(() => ({})));
  if (input.error) return NextResponse.json({ ok: false, error: input.error }, { status: 400 });
  const workspaceId = guard.auth.workspaceId;
  const { data, error } = await guard.supabase.rpc('ai_knowledge_propose', {
    p_workspace_id: workspaceId, p_item_key: input.item_key, p_kind: input.kind, p_title: input.title,
    p_content: input.content, p_intents: input.intents, p_keywords: input.keywords, p_metadata: input.metadata,
    p_priority: input.priority, p_source: 'manual', p_actor: guard.auth.userId,
  });
  if (error) return NextResponse.json({ ok: false, error: 'Falha ao salvar.' }, { status: 500 });
  const { data: active } = await guard.supabase.from('ai_knowledge_items').select('id, item_key, kind, title, intents, metadata, priority, status')
    .eq('workspace_id', workspaceId).eq('status', 'active');
  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ ok: true, id: row?.id, version: row?.version, status: 'pending_approval', conflicts: detectConflicts(active || [], input) });
}
