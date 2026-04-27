import { buildRepertoirePdfHtml } from '@/lib/repertorio/buildRepertoirePdfHtml';
import { generatePdfBufferFromHtml } from '@/lib/contracts/htmlToPdfService';
import { logInfo } from '@/lib/observability/server-log';

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

export async function generateRepertoirePdf({
  supabase,
  eventId,
  token,
  clientToken,
}) {
  logInfo('REPERTOIRE_PDF', 'START', {
    marker: '[REPERTOIRE_PDF][START]',
    eventId,
    token: normalizeText(token),
    clientToken: normalizeText(clientToken),
  });

  if (!supabase) throw new Error('Supabase é obrigatório para gerar PDF do repertório.');
  if (!eventId) throw new Error('eventId é obrigatório para gerar PDF do repertório.');

  const [configResult, itemsResult, eventResult] = await Promise.all([
    supabase
      .from('repertoire_config')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase
      .from('repertoire_items')
      .select('*')
      .eq('event_id', eventId)
      .order('item_order', { ascending: true }),
    supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle(),
  ]);

  if (configResult.error) throw configResult.error;
  if (itemsResult.error) throw itemsResult.error;
  if (eventResult.error) throw eventResult.error;

  const config = configResult.data || {};
  const items = itemsResult.data || [];
  const event = eventResult.data || {};

  let client = null;
  const contactId = event?.contact_id;
  if (contactId) {
    const { data: clientRow, error: clientError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .maybeSingle();

    if (clientError) throw clientError;
    client = clientRow || null;
  }

  const html = buildRepertoirePdfHtml({
    event,
    client,
    config,
    items,
  });

  logInfo('REPERTOIRE_PDF', 'HTML_READY', {
    marker: '[REPERTOIRE_PDF][HTML_READY]',
    eventId,
    itemsCount: items.length,
  });

  const pdfBuffer = await generatePdfBufferFromHtml({
    html,
    contractId: null,
    precontractId: null,
    applyPremiumContractCss: false,
    fileName: `repertorio-${eventId}.pdf`,
  });

  logInfo('REPERTOIRE_PDF', 'PDF_GENERATED', {
    marker: '[REPERTOIRE_PDF][PDF_GENERATED]',
    eventId,
    bytes: pdfBuffer?.length || 0,
  });

  return {
    ok: true,
    pdfBuffer,
    fileName: `repertorio-${eventId}.pdf`,
  };
}
