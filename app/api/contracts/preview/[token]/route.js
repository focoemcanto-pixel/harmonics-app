import { NextResponse } from 'next/server';

export async function GET(_request, { params }) {
  try {
    const token = String(params?.token || '').trim();

    if (!token) {
      return new NextResponse('Token inválido.', { status: 400 });
    }

    const gasExec = process.env.HARMONICS_CONTRATO_GAS_EXEC_URL;
    const hk = process.env.HARMONICS_KEY_CONTRATO || '';

    if (!gasExec) {
      return new NextResponse(
        'HARMONICS_CONTRATO_GAS_EXEC_URL não configurada.',
        { status: 500 }
      );
    }

    const previewResp = await fetch(gasExec, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fn: 'hcContratoGerarPreview',
        args: [token],
        __hk: hk,
        __origin: 'CONTRATO',
        __ip: '',
      }),
      redirect: 'follow',
      cache: 'no-store',
    });

    const previewJson = await previewResp.json();

    if (!previewJson?.ok || !previewJson?.pdfUrl) {
      return new NextResponse(
        previewJson?.message || 'Não foi possível gerar a prévia do contrato.',
        { status: 400 }
      );
    }

    const pdfResp = await fetch(previewJson.pdfUrl, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
    });

    if (!pdfResp.ok) {
      return new NextResponse('Não foi possível carregar o PDF.', {
        status: 400,
      });
    }

    const pdfArrayBuffer = await pdfResp.arrayBuffer();

    return new NextResponse(pdfArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return new NextResponse(
      error?.message || 'Erro ao gerar prévia do contrato.',
      { status: 500 }
    );
  }
}