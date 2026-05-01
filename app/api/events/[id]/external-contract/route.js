import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';
import { saveExternalContractForEvent } from '@/lib/contracts/external-contract-flow';

const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024;

function normalizeText(value) {
  return String(value || '').trim();
}

export async function POST(request, { params }) {
  const supabase = getSupabaseAdmin();
  const routeParams = await params;
  const eventId = normalizeText(routeParams?.id);
  try {
    const auth = await requireAdmin({ supabase, request, logPrefix: '[EXTERNAL_CONTRACT_API]' });
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
    const form = await request.formData();
    const file = form.get('file');
    const replace = String(form.get('replace') || '').toLowerCase() === 'true';
    if (!eventId) return NextResponse.json({ ok: false, error: 'Evento inválido.' }, { status: 400 });
    if (!file || typeof file === 'string') return NextResponse.json({ ok: false, error: 'Arquivo PDF é obrigatório.' }, { status: 400 });
    if (file.type !== 'application/pdf') return NextResponse.json({ ok: false, error: 'Apenas PDF (application/pdf) é aceito.' }, { status: 400 });
    if (file.size > MAX_PDF_SIZE_BYTES) return NextResponse.json({ ok: false, error: 'PDF excede o limite de 15MB.' }, { status: 400 });

    const { data: event, error: eventError } = await supabase.from('events').select('id, client_contact_id').eq('id', eventId).maybeSingle();
    if (eventError) throw eventError;
    if (!event) return NextResponse.json({ ok: false, error: 'Evento não encontrado.' }, { status: 404 });

    const result = await saveExternalContractForEvent({
      supabase,
      eventId,
      file,
      replace,
      contactId: event?.client_contact_id,
      rawPayload: { external_contract: true, external_contract_uploaded_at: new Date().toISOString(), external_contract_source: 'admin_upload' },
    });

    return NextResponse.json({ ok: true, contract: result.contract, client_panel_link: result.clientPanelLink, pdf_url: result.pdfUrl });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || 'Falha ao anexar contrato externo.' }, { status: error?.status || 500 });
  }
}
