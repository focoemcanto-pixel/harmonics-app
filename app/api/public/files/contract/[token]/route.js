import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createContractSignedUrl, resolveContractStoragePath } from '@/lib/contracts/contract-storage';

export const dynamic = 'force-dynamic';

// PDF do contrato para quem tem o link do contrato/portal (token do recurso), entregue por
// URL assinada de curta duração. Prepara o fechamento do bucket público: os links novos passam
// a apontar para cá em vez da URL pública do storage.
const SIGNED_URL_TTL_SECONDS = 10 * 60;

function notFound() {
  return NextResponse.json({ ok: false, error: 'Arquivo não encontrado.' }, { status: 404 });
}

async function resolveContractByToken(supabase, token) {
  const { data: byContract } = await supabase
    .from('contracts')
    .select('id, pdf_url, precontract_id')
    .eq('public_token', token)
    .maybeSingle();
  if (byContract?.pdf_url) return byContract;

  const { data: precontract } = await supabase
    .from('precontracts')
    .select('id')
    .eq('public_token', token)
    .maybeSingle();
  if (!precontract?.id) return null;

  const { data: byPrecontract } = await supabase
    .from('contracts')
    .select('id, pdf_url, precontract_id')
    .eq('precontract_id', precontract.id)
    .not('pdf_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return byPrecontract || null;
}

export async function GET(_request, context) {
  const params = await context?.params;
  const token = String(params?.token || '').trim();
  if (!token || token.length < 8 || token.length > 200) return notFound();

  const supabase = getSupabaseAdmin();
  const contract = await resolveContractByToken(supabase, token);
  if (!contract?.pdf_url) return notFound();

  const { bucket, path } = resolveContractStoragePath(contract.pdf_url);
  if (!bucket || !path) {
    // URL externa (ex.: Google Drive): mantém o comportamento anterior.
    return NextResponse.redirect(contract.pdf_url, { status: 302 });
  }

  const { url, error } = await createContractSignedUrl({ supabase, bucket, path, expiresIn: SIGNED_URL_TTL_SECONDS });
  if (error || !url) {
    console.error('[PUBLIC_CONTRACT_FILE][SIGNED_URL_FAILED]', { contractId: contract.id, message: error?.message });
    return NextResponse.json({ ok: false, error: 'Não foi possível abrir o PDF agora.' }, { status: 502 });
  }

  return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'no-store' } });
}
