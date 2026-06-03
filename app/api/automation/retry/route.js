import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';

const AUTOMATION_RETRY_TIMEOUT_MS = 20_000;

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function buildInternalHeaders(request) {
  const headers = { 'Content-Type': 'application/json' };

  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (internalSecret) {
    headers['x-internal-api-secret'] = internalSecret;
  } else {
    const cookie = request.headers.get('cookie');
    if (cookie) {
      headers.cookie = cookie;
    }
  }

  return headers;
}

async function readJsonSafe(response) {
  return response.json().catch(() => ({}));
}

async function postAutomationSend({ baseUrl, request, eventType, entityId }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTOMATION_RETRY_TIMEOUT_MS);

  try {
    return await fetch(`${baseUrl}/api/automation/send`, {
      method: 'POST',
      headers: buildInternalHeaders(request),
      body: JSON.stringify({ eventType, entityId }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request) {
  const supabaseAdmin = getSupabaseAdmin();

  const auth = await requireAdmin({
    supabase: supabaseAdmin,
    request,
    logPrefix: '[AUTOMATION_RETRY]',
  });

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status || 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const logId = String(body?.logId || '').trim();

    if (!isUuid(logId)) {
      return NextResponse.json({ ok: false, error: 'logId inválido ou ausente' }, { status: 400 });
    }

    const { data: originalLog, error: logError } = await supabaseAdmin
      .from('automation_logs')
      .select('id, status, entity_id, metadata, rule_id, rule:rule_id(event_type)')
      .eq('id', logId)
      .maybeSingle();

    if (logError) throw logError;

    if (!originalLog) {
      return NextResponse.json({ ok: false, error: 'Log não encontrado' }, { status: 404 });
    }

    if (originalLog.status !== 'failed') {
      return NextResponse.json(
        { ok: false, error: 'Apenas logs com status "failed" podem ser re-tentados' },
        { status: 400 }
      );
    }

    const entityId = String(originalLog.entity_id || originalLog.metadata?.entityId || '').trim();
    const eventType = String(originalLog.metadata?.eventType || originalLog.rule?.event_type || '').trim();

    if (!entityId || !eventType) {
      return NextResponse.json(
        { ok: false, error: 'Dados insuficientes para retry (entity_id ou event_type ausente)' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
    const response = await postAutomationSend({ baseUrl, request, eventType, entityId });
    const result = await readJsonSafe(response);

    if (!response.ok) {
      throw new Error(result?.error || result?.message || 'Erro no motor de automação');
    }

    return NextResponse.json({
      ok: true,
      message: 'Retry executado com sucesso',
      result,
    });
  } catch (error) {
    const isAbort = error?.name === 'AbortError';
    console.error('[POST /api/automation/retry] Erro:', error);
    return NextResponse.json(
      { ok: false, error: isAbort ? 'Tempo limite ao executar retry da automação.' : error?.message || 'Erro interno' },
      { status: isAbort ? 504 : 500 }
    );
  }
}
