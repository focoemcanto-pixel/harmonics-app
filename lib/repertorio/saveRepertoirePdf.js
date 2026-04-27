import { logInfo, logWarn } from '@/lib/observability/server-log';

const BUCKET_NAME = 'repertoire-pdfs';

export async function saveRepertoirePdf({ supabase, eventId, pdfBuffer }) {
  logInfo('REPERTOIRE_PDF', 'UPLOAD_START', {
    marker: '[REPERTOIRE_PDF][UPLOAD_START]',
    eventId,
    bucket: BUCKET_NAME,
  });

  if (!supabase) throw new Error('Supabase é obrigatório para salvar PDF do repertório.');
  if (!eventId) throw new Error('eventId é obrigatório para salvar PDF do repertório.');
  if (!pdfBuffer) throw new Error('pdfBuffer é obrigatório para salvar PDF do repertório.');

  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (bucketsError) throw bucketsError;

  const hasBucket = (buckets || []).some((bucket) => bucket?.name === BUCKET_NAME);
  if (!hasBucket) {
    logWarn('REPERTOIRE_PDF', 'BUCKET_MISSING', {
      marker: '[REPERTOIRE_PDF][BUCKET_MISSING]',
      eventId,
      bucket: BUCKET_NAME,
    });
    return { ok: false, publicUrl: null, reason: 'BUCKET_MISSING' };
  }

  const filePath = `repertorios/${eventId}/repertorio-final.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, pdfBuffer, {
      upsert: true,
      contentType: 'application/pdf',
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

  logInfo('REPERTOIRE_PDF', 'UPLOAD_OK', {
    marker: '[REPERTOIRE_PDF][UPLOAD_OK]',
    eventId,
    filePath,
  });

  return {
    ok: true,
    publicUrl: data?.publicUrl || null,
  };
}
