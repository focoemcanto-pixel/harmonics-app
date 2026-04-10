import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  try {
    const token = String(params?.token || '').trim();

    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Token inválido.' },
        { status: 400 }
      );
    }

    const contractServiceUrl = String(
      process.env.CONTRACT_SERVICE_URL || ''
    ).trim();

    if (!contractServiceUrl) {
      return NextResponse.json(
        { ok: false, error: 'CONTRACT_SERVICE_URL não configurada.' },
        { status: 500 }
      );
    }

    const baseUrl = contractServiceUrl.replace(/\/+$/, '');
    const renderUrl = `${baseUrl}/api/repertoire/pdf/${encodeURIComponent(token)}`;

    const response = await fetch(renderUrl, {
      method: 'GET',
      cache: 'no-store',
    });

    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      let errorPayload = null;

      try {
        errorPayload = contentType.includes('application/json')
          ? await response.json()
          : await response.text();
      } catch {
        errorPayload = null;
      }

      return NextResponse.json(
        {
          ok: false,
          error:
            (typeof errorPayload === 'object' && errorPayload?.error) ||
            (typeof errorPayload === 'string' && errorPayload) ||
            `Falha ao gerar PDF no Render (status ${response.status}).`,
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
    console.error('[api/cliente/repertorio/pdf] erro ao buscar PDF no Render:', error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Erro ao gerar PDF do repertório.',
      },
      { status: 500 }
    );
  }
}
