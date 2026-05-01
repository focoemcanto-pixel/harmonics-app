import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/api/require-admin';

const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024;
const BUCKET_NAME = 'contract-pdfs';

function normalizeText(value) {
  return String(value || '').trim();
}

function buildToken() {
  return `${Date.now().toString(36)}-${randomUUID().replace(/-/g, '')}`;
}

export async function POST(request, { params }) {
  const supabase = getSupabaseAdmin();
  const routeParams = await params;
  const eventId = normalizeText(routeParams?.id);

  try {
    const auth = await requireAdmin({ supabase, request, logPrefix: '[EXTERNAL_CONTRACT_API]' });
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 });
    }

    const form = await request.formData();
    const file = form.get('file');
    const replace = String(form.get('replace') || '').toLowerCase() === 'true';

    if (!eventId) return NextResponse.json({ ok: false, error: 'Evento inválido.' }, { status: 400 });
    if (!file || typeof file === 'string') return NextResponse.json({ ok: false, error: 'Arquivo PDF é obrigatório.' }, { status: 400 });
    if (file.type !== 'application/pdf') return NextResponse.json({ ok: false, error: 'Apenas PDF (application/pdf) é aceito.' }, { status: 400 });
    if (file.size > MAX_PDF_SIZE_BYTES) return NextResponse.json({ ok: false, error: 'PDF excede o limite de 15MB.' }, { status: 400 });

    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) throw bucketsError;
    const hasBucket = (buckets || []).some((b) => b?.name === BUCKET_NAME);
    if (!hasBucket) {
      return NextResponse.json({ ok: false, error: 'Bucket contract-pdfs não encontrado no Supabase Storage.' }, { status: 500 });
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, client_contact_id')
      .eq('id', eventId)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) return NextResponse.json({ ok: false, error: 'Evento não encontrado.' }, { status: 404 });

    const { data: existingContract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (contractError) throw contractError;

    if (String(existingContract?.status || '').toLowerCase() === 'signed' && !replace) {
      return NextResponse.json({ ok: false, error: 'Já existe contrato assinado. Envie replace=true para substituir o PDF.' }, { status: 409 });
    }

    const token = normalizeText(existingContract?.public_token) || buildToken();
    const timestamp = Date.now();
    const storagePath = `external-contracts/events/${eventId}/contrato-externo-${timestamp}.pdf`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(storagePath, bytes, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (uploadError) {
      return NextResponse.json({ ok: false, error: uploadError.message || 'Falha no upload do PDF.' }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
    const pdfUrl = normalizeText(publicUrlData?.publicUrl);
    const nowIso = new Date().toISOString();
    const rawPayload = {
      ...(existingContract?.raw_payload || {}),
      external_contract: true,
      external_contract_uploaded_at: nowIso,
      external_contract_source: 'admin_upload',
    };

    const payload = {
      event_id: eventId,
      contact_id: event?.client_contact_id || existingContract?.contact_id || null,
      public_token: token,
      pdf_url: pdfUrl,
      status: 'signed',
      signed_at: nowIso,
      raw_payload: rawPayload,
    };

    const saveQuery = existingContract?.id
      ? supabase.from('contracts').update(payload).eq('id', existingContract.id)
      : supabase.from('contracts').insert(payload);

    const { data: savedContract, error: saveError } = await saveQuery.select('*').single();
    if (saveError) throw saveError;

    const { data: existingCfg, error: cfgError } = await supabase
      .from('repertoire_config')
      .select('id, client_public_token')
      .eq('event_id', eventId)
      .maybeSingle();
    if (cfgError) throw cfgError;

    if (!existingCfg?.id) {
      const { error: insertCfgError } = await supabase.from('repertoire_config').insert({
        event_id: eventId,
        status: 'LIBERADO',
        is_locked: false,
        client_public_token: token,
      });
      if (insertCfgError) throw insertCfgError;
    } else if (!normalizeText(existingCfg.client_public_token)) {
      const { error: updateCfgError } = await supabase
        .from('repertoire_config')
        .update({ client_public_token: token })
        .eq('id', existingCfg.id);
      if (updateCfgError) throw updateCfgError;
    }

    return NextResponse.json({ ok: true, contract: savedContract, client_panel_link: `/cliente/${token}`, pdf_url: pdfUrl });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || 'Falha ao anexar contrato externo.' }, { status: 500 });
  }
}
