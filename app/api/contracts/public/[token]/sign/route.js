import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireRequiredEnv } from '@/lib/config/validate-env';
import { logError, maskToken } from '@/lib/observability/server-log';
import { getRequestIp, getUserAgent } from '@/lib/api/request-meta';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { signInternalContract } from '@/lib/contracts/sign-internal-contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function asString(value) { return String(value || '').trim(); }
function extractToken(params) { return Array.isArray(params?.token) ? asString(params.token[0]) : asString(params?.token); }
function resolveSignatureOrigin(rawOrigin) { return asString(rawOrigin).toLowerCase() === 'cliente' ? 'CLIENTE' : 'Sistema Harmonics'; }

export async function POST(request, context) {
  const token = extractToken(await context?.params);
  const requestIp = getRequestIp(request);
  const requestUserAgent = getUserAgent(request);
  if (!token) return NextResponse.json({ ok: false, message: 'Token inválido.' }, { status: 400 });

  const rateLimitResult = checkRateLimit({ key: `contract-sign:${requestIp || 'ip-na'}:${maskToken(token) || 'token-na'}`, limit: 10, windowMs: 15 * 60 * 1000 });
  if (!rateLimitResult.ok) return NextResponse.json({ ok: false, error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfterSeconds || 60) } });

  try {
    requireRequiredEnv('contracts/public-sign');
    const body = await request.json().catch(() => null);
    const supabase = getSupabaseAdmin();

    const result = await signInternalContract({
      supabase,
      token,
      html: asString(body?.html || body?.signedHtml),
      signerName: asString(body?.signerName) || 'Não informado',
      signerCpf: asString(body?.signerCpf) || 'Não informado',
      origin: resolveSignatureOrigin(body?.origin),
      requestHeaders: request.headers,
      ip: requestIp,
      userAgent: asString(request.headers.get('user-agent')) || requestUserAgent || 'Não disponível',
    });

    if (!result?.pdfUrl) return NextResponse.json({ ok: false, message: 'Falha ao gerar PDF interno.' }, { status: 502 });
    return NextResponse.json(result);
  } catch (error) {
    logError('CONTRACT_PUBLIC_SIGN', 'ERROR', error, { token: maskToken(token), code: error?.code || null, stage: error?.stage || null, message: error?.message || String(error) });
    return NextResponse.json({ ok: false, message: error?.message || 'Erro ao assinar contrato.', code: error?.code || null, stage: error?.stage || null }, { status: error?.status || 500 });
  }
}
