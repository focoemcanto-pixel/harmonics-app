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
  await guard.supabase.from('ai_channels').update({ last_eligibility: { ...status, checked_at: checkedAt } }).eq('id', channel.id);
  return NextResponse.json({ ok: status.ok, eligibility: { ...status, checked_at: checkedAt } });
}
