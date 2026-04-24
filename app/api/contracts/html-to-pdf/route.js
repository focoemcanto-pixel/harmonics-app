import { NextResponse } from 'next/server';
import { generatePdfBufferFromHtml } from '@/lib/contracts/htmlToPdfService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const html = String(body?.html || '').trim();
    const contractId = String(body?.contractId || '').trim() || null;
    const precontractId = String(body?.precontractId || '').trim() || null;

    if (!html) {
      return NextResponse.json(
        { ok: false, message: 'HTML final é obrigatório para converter em PDF.' },
        { status: 400 }
      );
    }

    const pdfBuffer = await generatePdfBufferFromHtml({
      html,
      contractId,
      precontractId,
    });

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[CONTRACT_HTML_TO_PDF] erro ao converter HTML em PDF:', error);

    return NextResponse.json(
      {
        ok: false,
        message: error?.message || 'Erro ao converter HTML do contrato em PDF.',
      },
      { status: 500 }
    );
  }
}
