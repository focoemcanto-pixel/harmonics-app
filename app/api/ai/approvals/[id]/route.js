import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';

export const dynamic = 'force-dynamic';

// Aprovação humana (admin) de proposta/desconto/alteração solicitada pela IA.
// Aprovar proposta cria um orçamento em RASCUNHO no módulo Orçamentos — nada é enviado ao cliente.
export async function POST(request, { params }) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][APPROVAL]' });
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const decision = body?.decision;
  if (decision !== 'approved' && decision !== 'rejected') {
    return NextResponse.json({ ok: false, error: 'Decisão inválida.' }, { status: 400 });
  }
  const workspaceId = guard.auth.workspaceId;
  const { data: approval } = await guard.supabase.from('ai_approvals')
    .update({ status: decision, decided_by: guard.auth.userId, decided_at: new Date().toISOString() })
    .eq('id', id).eq('workspace_id', workspaceId).eq('status', 'pending')
    .select('id, kind, conversation_id, details').maybeSingle();
  if (!approval) return NextResponse.json({ ok: false, error: 'Solicitação não encontrada.' }, { status: 404 });

  let quoteId = null;
  if (decision === 'approved' && approval.kind === 'proposal') {
    const { data: conversation } = await guard.supabase.from('ai_conversations')
      .select('contact_name, provider_chat_id').eq('id', approval.conversation_id).eq('workspace_id', workspaceId).maybeSingle();
    const lead = approval.details?.lead || {};
    const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(String(lead.data_evento || '')) ? lead.data_evento : null;
    const { data: quote } = await guard.supabase.from('quotes').insert({
      workspace_id: workspaceId,
      status: 'draft',
      client_name: lead.nome || conversation?.contact_name || null,
      client_phone: conversation?.provider_chat_id || null,
      event_type: lead.tipo_evento || null,
      event_date: eventDate,
      location_name: lead.local || lead.cidade || null,
      formation: lead.formacao || null,
      notes: 'Rascunho criado a partir do Inbox (IA). Revisar valores antes de enviar.',
    }).select('id').maybeSingle();
    quoteId = quote?.id || null;
  }
  return NextResponse.json({ ok: true, quote_id: quoteId });
}
