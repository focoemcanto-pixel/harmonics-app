import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function extractTokenFromUrl(request, params) {
  const paramToken = String(params?.token || '').trim();
  if (paramToken) return paramToken;

  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/').filter(Boolean);
    return String(parts[parts.length - 1] || '').trim();
  } catch {
    return '';
  }
}

export async function GET(request, { params }) {
  try {
    const token = extractTokenFromUrl(request, params);
    console.log('[PDF PROXY] token recebido:', token);

    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Token inválido.' },
        { status: 400 }
      );
    }

    const contractServiceUrl = String(process.env.CONTRACT_SERVICE_URL || '').trim();
    console.log('[PDF PROXY] CONTRACT_SERVICE_URL:', contractServiceUrl);

    if (!contractServiceUrl) {
      return NextResponse.json(
        { ok: false, error: 'CONTRACT_SERVICE_URL não configurada.' },
        { status: 500 }
      );
    }

    const renderUrl = `${contractServiceUrl.replace(/\/+$/, '')}/api/repertoire/pdf/${encodeURIComponent(token)}`;
    console.log('[PDF PROXY] chamando Render:', renderUrl);

    const response = await fetch(renderUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/pdf,application/json,text/plain,*/*',
      },
    });

    console.log('[PDF PROXY] status do Render:', response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error('[PDF PROXY] erro vindo do Render:', text);

      return NextResponse.json(
        {
          ok: false,
          error: text || `Erro no Render: ${response.status}`,
        },
        { status: response.status }
      );
    }

    const pdfBuffer = await response.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="repertorio-${token}.pdf"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[PDF PROXY] erro geral:', error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Erro ao gerar PDF do repertório.',
      },
      { status: 500 }
    );
  }
}
