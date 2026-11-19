import { NextResponse } from 'next/server';
import { guardWorkspaceAdmin } from '@/lib/api/route-guards';
import { decryptSecret } from '@/lib/ai/inbox/secret-box.mjs';
import { fetchPhoneNumberStatus } from '@/lib/ai/inbox/meta-client.mjs';

export const dynamic = 'force-dynamic';

// Diagnóstico somente leitura do número na Cloud API (Coexistence, qualidade, nome).
// Não registra, não migra e não desconecta número algum.
export async function POST(request) {
  const guard = await guardWorkspaceAdmin(request, { logPrefix: '[AI][ELIGIBILITY]' });
  if (!guard.ok) return guard.response;
  const workspaceId = guard.auth.workspaceId;
  const { data: channel } = await guard.supabase.from('ai_channels').select('id, phone_number_id, access_token_encrypted')
    .eq('workspace_id', workspaceId).eq('provider', 'meta_cloud').maybeSingle();
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
    // O banco deve refletir somente o sinal oficial da Meta, jamais um checkbox
    // arbitrário vindo do cliente. Falhas não promovem o número a Coexistência.
    coexistence: status.ok === true && status.isOnBizApp === true,
  };
  const { error: updateError } = await guard.supabase.from('ai_channels')
    .update(update).eq('id', channel.id).eq('workspace_id', workspaceId);
  if (updateError) {
    console.error('[AI][ELIGIBILITY][STORE_ERROR]', { code: updateError.code });
    return NextResponse.json({ ok: false, error: 'Falha ao registrar diagnóstico na configuração do canal.' }, { status: 503 });
  }
  return NextResponse.json({ ok: status.ok, eligibility: { ...status, checked_at: checkedAt } });
}
