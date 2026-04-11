import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  try {
    const token = String(params?.token || '').trim();
    console.log('[PDF PROXY] token recebido:', token);

    const contractServiceUrl = String(process.env.CONTRACT_SERVICE_URL || '').trim();

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

    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      const text = await response.text();

      return new NextResponse(text || `Erro no Render: ${response.status}`, {
        status: response.status,
        headers: {
          'Content-Type': contentType || 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    const body = await response.arrayBuffer();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        'Content-Type': contentType || 'application/pdf',
        'Content-Disposition': `inline; filename="repertorio-${token || 'arquivo'}.pdf"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Erro ao gerar PDF do repertório.',
      },
      { status: 500 }
    );
  }
}
