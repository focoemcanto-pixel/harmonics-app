import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { decryptSecret } from '@/lib/ai/inbox/secret-box.mjs';
import { fetchPhoneNumberStatus } from '@/lib/ai/inbox/meta-client.mjs';
import { nextChannelRevision } from '@/lib/ai/inbox/channel-identity.mjs';

export const dynamic = 'force-dynamic';

// Diagnóstico somente leitura do número na Cloud API (Coexistence, qualidade, nome).
// Não registra, não migra e não desconecta número algum.
export async function POST(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][ELIGIBILITY]' });
  if (!guard.ok) return guard.response;
  const workspaceId = guard.auth.workspaceId;
  const { data: channel, error: channelError } = await guard.supabase.from('ai_channels')
    .select('id, phone_number_id, access_token_encrypted, updated_at')
    .eq('workspace_id', workspaceId).eq('provider', 'meta_cloud').maybeSingle();
  if (channelError) {
    console.error('[AI][ELIGIBILITY][CHANNEL_READ_ERROR]', { code: channelError.code });
    return NextResponse.json({ ok: false, error: 'Não foi possível consultar o canal.' }, { status: 503 });
  }
  if (!channel?.access_token_encrypted) {
    return NextResponse.json({ ok: false, error: 'Configure Phone Number ID e token primeiro.' }, { status: 400 });
  }
  let token;
  try {
    token = await decryptSecret(channel.access_token_encrypted);
  } catch {
    return NextResponse.json({ ok: false, error: 'Não foi possível ler a credencial.' }, { status: 503 });
  }
  const status = await fetchPhoneNumberStatus({ phoneNumberId: channel.phone_number_id, token });
  const checkedAt = new Date().toISOString();
  const update = {
    last_eligibility: { ...status, checked_at: checkedAt },
    // O diagnóstico pertence à identidade consultada. Consultas concorrentes
    // ou com token/Phone Number ID já trocado não podem revalidar o canal.
    coexistence: status.ok === true && status.isOnBizApp === true,
    updated_at: nextChannelRevision(channel.updated_at),
  };
  const { data: saved, error: updateError } = await guard.supabase.from('ai_channels')
    .update(update)
    .eq('id', channel.id).eq('workspace_id', workspaceId).eq('provider', 'meta_cloud')
    .eq('phone_number_id', channel.phone_number_id)
    .eq('updated_at', channel.updated_at)
    .select('id').maybeSingle();
  if (updateError) {
    console.error('[AI][ELIGIBILITY][STORE_ERROR]', { code: updateError.code });
    return NextResponse.json({ ok: false, error: 'Falha ao registrar diagnóstico na configuração do canal.' }, { status: 503 });
  }
  if (!saved) {
    return NextResponse.json({
      ok: false, error: 'O número ou token foi alterado durante a consulta. Verifique novamente a configuração atual.',
    }, { status: 409 });
  }
  return NextResponse.json({ ok: status.ok, eligibility: { ...status, checked_at: checkedAt } });
}
