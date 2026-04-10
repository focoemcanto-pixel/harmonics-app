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

    console.log('[PDF PROXY] chamando Render:', renderUrl);

    const response = await fetch(renderUrl, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text();

      console.error('[PDF PROXY] erro do Render:', text);

      return NextResponse.json(
        {
          ok: false,
          error: `Erro no Render: ${response.status}`,
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
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[PDF PROXY] erro geral:', error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Erro ao gerar PDF',
      },
      { status: 500 }
    );
  }
}
