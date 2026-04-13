import { NextResponse } from 'next/server';

function validateBody(body) {
  const missing = [];
  if (!body.name) missing.push('name');
  if (!body.provider) missing.push('provider');
  if (!body.api_url) missing.push('api_url');
  if (!body.api_key) missing.push('api_key');
  if (!body.instance_id) missing.push('instance_id');
  return missing;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const missing = validateBody(body);

    if (missing.length > 0) {
      return NextResponse.json({ error: `Campos obrigatórios: ${missing.join(', ')}` }, { status: 400 });
    }

    if (String(body.provider).toLowerCase() !== 'wasender') {
      return NextResponse.json({ error: 'Apenas provider wasender é suportado no momento' }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let targetUrl;
    try {
      targetUrl = new URL(body.api_url).toString();
    } catch {
      targetUrl = new URL(`https://${String(body.api_url).replace(/^\/+/, '')}`).toString();
    }

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${body.api_key}` },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return NextResponse.json({
      ok: true,
      status: response.status,
      statusText: response.statusText,
      target_url: targetUrl,
    });
  } catch (error) {
    return NextResponse.json({ error: `Falha no ping do provider: ${error?.message || 'erro interno'}` }, { status: 500 });
  }
}
