import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { isMetaTestChannel } from '@/lib/ai/inbox/service.mjs';

export const dynamic = 'force-dynamic';

// "Reiniciar teste da Nara": SOMENTE no canal de teste da Meta (+1 555…). Cancela respostas pendentes,
// encerra pedidos de vocalista da conversa e apaga conversa, histórico e memória do contato (mesma
// exclusão da LGPD, ai_erase_contact). A próxima mensagem começa como primeiro atendimento.
// Não toca em tabelas, configurações, outros contatos, contratos nem no WaSender.
export async function POST(request, { params }) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][RESET_TEST]' });
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== 'REINICIAR') return NextResponse.json({ ok: false, error: 'Confirmação obrigatória.' }, { status: 400 });
  const workspaceId = guard.auth.workspaceId;

  const { data: channel } = await guard.supabase.from('ai_channels').select('display_phone')
    .eq('workspace_id', workspaceId).eq('provider', 'meta_cloud').maybeSingle();
  if (!isMetaTestChannel(channel)) return NextResponse.json({ ok: false, error: 'Disponível apenas no canal de teste.' }, { status: 403 });

  const { data: conversation } = await guard.supabase.from('ai_conversations').select('id, provider_chat_id')
    .eq('id', id).eq('workspace_id', workspaceId).maybeSingle();
  if (!conversation) return NextResponse.json({ ok: false, error: 'Conversa não encontrada.' }, { status: 404 });

  const now = new Date().toISOString();
  // 1) Nenhuma resposta antiga sai: cancela a fila antes de apagar (corrida com o despacho).
  await guard.supabase.from('ai_message_outbox').update({ status: 'cancelled', last_error: 'test_reset', updated_at: now })
    .eq('workspace_id', workspaceId).eq('conversation_id', conversation.id).in('status', ['pending', 'draft', 'dispatching']);
  // 2) Pedidos de vocalista desta conversa deixam de valer (tabela sem vínculo em cascata).
  await guard.supabase.from('ai_vocalist_requests').update({ status: 'cancelled', notes: 'test_reset', updated_at: now })
    .eq('workspace_id', workspaceId).eq('conversation_id', conversation.id)
    .in('status', ['awaiting_approval', 'approved_waiting_event', 'conflict']);
  // 3) Apaga conversa, mensagens, memória e efeitos (cascata), só deste contato.
  const { data: deleted, error } = await guard.supabase.rpc('ai_erase_contact', {
    p_workspace_id: workspaceId, p_provider_chat_id: conversation.provider_chat_id,
  });
  if (error) return NextResponse.json({ ok: false, error: 'Falha ao reiniciar.' }, { status: 500 });
  console.info('[AI][RESET_TEST]', { workspaceId, conversations: deleted });
  return NextResponse.json({ ok: true, deleted });
}
