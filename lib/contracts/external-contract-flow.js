import { randomUUID } from 'node:crypto';

const BUCKET_NAME = 'contract-pdfs';

function normalizeText(value) {
  return String(value || '').trim();
}

function buildToken() {
  return `${Date.now().toString(36)}-${randomUUID().replace(/-/g, '')}`;
}

export async function ensureRepertoireConfigForEvent({ supabase, eventId, publicToken }) {
  const { data: existingCfg, error } = await supabase.from('repertoire_config').select('id, client_public_token').eq('event_id', eventId).maybeSingle();
  if (error) throw error;
  if (!existingCfg?.id) {
    const { error: insertError } = await supabase.from('repertoire_config').insert({ event_id: eventId, status: 'LIBERADO', is_locked: false, client_public_token: publicToken });
    if (insertError) throw insertError;
    return;
  }
  if (!normalizeText(existingCfg.client_public_token)) {
    const { error: updateError } = await supabase.from('repertoire_config').update({ client_public_token: publicToken }).eq('id', existingCfg.id);
    if (updateError) throw updateError;
  }
}

export async function ensureClientPanelForExternalContract({ supabase, eventId, contactId, existingContract, pdfUrl, rawPayload, replace, workspaceId = null }) {
  if (String(existingContract?.status || '').toLowerCase() === 'signed' && !replace) {
    const e = new Error('Já existe contrato assinado. Envie replace=true para substituir o PDF.');
    e.status = 409;
    throw e;
  }
  const nowIso = new Date().toISOString();
  const token = normalizeText(existingContract?.public_token) || buildToken();
  const payload = {
    workspace_id: normalizeText(existingContract?.workspace_id || workspaceId) || null,
    event_id: eventId,
    contact_id: contactId || existingContract?.contact_id || null,
    public_token: token,
    pdf_url: pdfUrl,
    status: 'signed',
    signed_at: nowIso,
    raw_payload: { ...(existingContract?.raw_payload || {}), ...(rawPayload || {}) },
  };
  const saveQuery = existingContract?.id ? supabase.from('contracts').update(payload).eq('id', existingContract.id) : supabase.from('contracts').insert(payload);
  const { data: savedContract, error } = await saveQuery.select('*').single();
  if (error) throw error;
  await ensureRepertoireConfigForEvent({ supabase, eventId, publicToken: token });
  return { contract: savedContract, clientPanelLink: `/cliente/${token}` };
}

export async function saveExternalContractForEvent({ supabase, eventId, file, replace = false, contactId = null, rawPayload = {}, workspaceId = null }) {
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (bucketsError) throw bucketsError;
  if (!(buckets || []).some((b) => b?.name === BUCKET_NAME)) throw new Error('Bucket contract-pdfs não encontrado no Supabase Storage.');

  let contractQuery = supabase.from('contracts').select('*').eq('event_id', eventId).order('created_at', { ascending: false }).limit(1);
  if (workspaceId) contractQuery = contractQuery.eq('workspace_id', workspaceId);
  const { data: existingContract, error: contractError } = await contractQuery.maybeSingle();
  if (contractError) throw contractError;

  const timestamp = Date.now();
  const storagePath = `external-contracts/events/${eventId}/contrato-externo-${timestamp}.pdf`;
  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(storagePath, bytes, { contentType: 'application/pdf', upsert: true });
  if (uploadError) throw new Error(uploadError.message || 'Falha no upload do PDF.');

  const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
  const pdfUrl = normalizeText(publicUrlData?.publicUrl);
  const result = await ensureClientPanelForExternalContract({ supabase, eventId, contactId, existingContract, pdfUrl, rawPayload, replace, workspaceId });
  return { ...result, pdfUrl };
}
