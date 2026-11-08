import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { clearKnowledgeCache } from '@/lib/ai/commercial/engine.mjs';

export const dynamic = 'force-dynamic';

// approve (ativa e arquiva a anterior), reject, archive, rollback (= ativar versão antiga).
export async function POST(request, { params }) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][KNOWLEDGE][ACTION]' });
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const { action, confirm_review: confirmReview } = await request.json().catch(() => ({}));
  const workspaceId = guard.auth.workspaceId;
  let result;
  if (action === 'approve' || action === 'rollback') {
    // Cláusulas marcadas como duvidosas exigem confirmação explícita de revisão humana.
    const { data: item } = await guard.supabase.from('ai_knowledge_items').select('metadata')
      .eq('id', id).eq('workspace_id', workspaceId).maybeSingle();
    const review = item?.metadata?.review;
    if (review?.required && confirmReview !== true) {
      return NextResponse.json({ ok: false, code: 'REVIEW_REQUIRED', error: 'Este item precisa de revisão antes da aprovação.', review }, { status: 409 });
    }
    result = await guard.supabase.rpc('ai_knowledge_activate', { p_workspace_id: workspaceId, p_id: id, p_actor: guard.auth.userId });
  } else if (action === 'reject' || action === 'archive') {
    result = await guard.supabase.from('ai_knowledge_items').update({ status: action === 'reject' ? 'rejected' : 'archived' })
      .eq('id', id).eq('workspace_id', workspaceId).select('id').maybeSingle();
    if (!result.error && !result.data) return NextResponse.json({ ok: false, error: 'Não encontrado.' }, { status: 404 });
  } else {
    return NextResponse.json({ ok: false, error: 'Ação inválida.' }, { status: 400 });
  }
  if (result.error) return NextResponse.json({ ok: false, error: 'Não foi possível aplicar.' }, { status: result.error.code === 'P0002' ? 404 : 409 });
  clearKnowledgeCache();
  return NextResponse.json({ ok: true });
}
