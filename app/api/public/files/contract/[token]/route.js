import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  createContractSignedUrl,
  extractContractStoragePath,
  extractWorkspaceIdFromStoragePath,
  resolveContractBucketName,
  resolveContractStoragePath,
} from '@/lib/contracts/contract-storage';

export const dynamic = 'force-dynamic';

// PDF do contrato para quem tem o link do contrato/portal (token do recurso), entregue por
// URL assinada de curta duração. Prepara o fechamento do bucket público: os links novos passam
// a apontar para cá em vez da URL pública do storage.
const SIGNED_URL_TTL_SECONDS = 10 * 60;

function notFound() {
  return NextResponse.json({ ok: false, error: 'Arquivo não encontrado.' }, { status: 404 });
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

// Só redireciona para destinos conhecidos (Drive/Docs do Google e o storage do próprio projeto):
// o pdf_url vem do banco, mas o endpoint é público e não pode virar redirecionador aberto.
function isAllowedRedirect(value) {
  try {
    const host = new URL(String(value || '').trim()).hostname.toLowerCase();
    if (host === 'drive.google.com' || host === 'docs.google.com') return true;
    const supabaseHost = new URL(String(process.env.NEXT_PUBLIC_SUPABASE_URL || '')).hostname.toLowerCase();
    return Boolean(supabaseHost) && host === supabaseHost;
  } catch {
    return false;
  }
}

// Assina apenas arquivos do bucket de contratos e, quando o caminho traz o workspace, do
// mesmo workspace do contrato.
function isSignableForContract(contract, bucket, path) {
  if (!bucket || !path) return false;
  const allowedBuckets = new Set([resolveContractBucketName(), 'contract-pdfs']);
  if (!allowedBuckets.has(bucket)) return false;
  const pathWorkspaceId = extractWorkspaceIdFromStoragePath(path);
  if (pathWorkspaceId && contract.workspace_id && String(pathWorkspaceId) !== String(contract.workspace_id)) return false;
  return true;
}

async function latestContractWithPdf(supabase, column, value) {
  const { data } = await supabase
    .from('contracts')
    .select('id, pdf_url, precontract_id, workspace_id')
    .eq(column, value)
    .not('pdf_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function resolveContractByToken(supabase, token) {
  const { data: byContract } = await supabase
    .from('contracts')
    .select('id, pdf_url, precontract_id, workspace_id')
    .eq('public_token', token)
    .maybeSingle();
  if (byContract?.pdf_url) return byContract;

  const { data: precontract } = await supabase
    .from('precontracts')
    .select('id, event_id')
    .eq('public_token', token)
    .maybeSingle();
  if (!precontract?.id) return null;

  const byPrecontract = await latestContractWithPdf(supabase, 'precontract_id', precontract.id);
  if (byPrecontract) return byPrecontract;

  // Contrato externo anexado ao evento (sem precontract_id): mesmo contrato que o portal mostra.
  return precontract.event_id ? latestContractWithPdf(supabase, 'event_id', precontract.event_id) : null;
}

// `deps` só é usado em testes (cliente Supabase falso); o Next chama com (request, context).
export async function GET(_request, context, deps = {}) {
  const params = await context?.params;
  const token = String(params?.token || '').trim();
  if (!token || token.length < 8 || token.length > 200) return notFound();

  const supabase = deps.supabase || getSupabaseAdmin();
  const contract = await resolveContractByToken(supabase, token);
  if (!contract?.pdf_url) return notFound();

  const pdfUrl = String(contract.pdf_url).trim();
  const storage = extractContractStoragePath(pdfUrl);

  // URL externa (ex.: Google Drive): mantém o comportamento anterior (link direto).
  if (!(storage.bucket && storage.path) && isHttpUrl(pdfUrl)) {
    return isAllowedRedirect(pdfUrl) ? NextResponse.redirect(pdfUrl, { status: 302 }) : notFound();
  }

  const { bucket, path } = storage.bucket && storage.path ? storage : resolveContractStoragePath(pdfUrl);
  if (!isSignableForContract(contract, bucket, path)) return notFound();

  const { url, error } = await createContractSignedUrl({ supabase, bucket, path, expiresIn: SIGNED_URL_TTL_SECONDS });
  if (error || !url) {
    console.error('[PUBLIC_CONTRACT_FILE][SIGNED_URL_FAILED]', { contractId: contract.id, message: error?.message });
    // Enquanto o bucket for público, a URL original continua válida: não quebra o link.
    if (isHttpUrl(pdfUrl) && isAllowedRedirect(pdfUrl)) return NextResponse.redirect(pdfUrl, { status: 302 });
    return NextResponse.json({ ok: false, error: 'Não foi possível abrir o PDF agora.' }, { status: 502 });
  }

  return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'no-store' } });
}
