/**
 * Intake seguro de mídias do WhatsApp. Registra CANDIDATOS a comprovante;
 * NÃO extrai valores, NÃO cria pagamento e NÃO altera caixa operacional.
 * Extração e vínculo a eventos devem rodar em etapa posterior, auditável.
 */
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_DOCUMENT_MIME = new Set(['application/pdf']);

export function isIncomingProofMedia(event = {}) {
  if (event.kind !== 'message' || event.origin !== 'customer' || event.direction !== 'inbound') return false;
  if (!event.mediaId || !event.providerMessageId) return false;
  const mime = String(event.mediaMime || '').split(';')[0].trim().toLowerCase();
  if (event.messageType === 'image') return ALLOWED_IMAGE_MIME.has(mime);
  if (event.messageType === 'document') return ALLOWED_DOCUMENT_MIME.has(mime);
  return false;
}

/**
 * Replays de webhooks podem retornar inserted=false e message_id=null da RPC.
 * Resolve a mesma mensagem já persistida, sem assumir o contato pelo nome.
 */
export async function stagePaymentEvidence({ supabase, workspaceId, event, messageRow }) {
  if (!isIncomingProofMedia(event)) return { staged: false, reason: 'not_candidate' };
  if (!workspaceId || !messageRow?.conversation_id) throw new Error('evidence_missing_workspace_or_conversation');

  let messageId = messageRow.message_id || null;
  if (!messageId) {
    const { data, error } = await supabase.from('ai_messages').select('id')
      .eq('workspace_id', workspaceId)
      .eq('provider_message_id', event.providerMessageId).maybeSingle();
    if (error) throw error;
    messageId = data?.id || null;
  }
  if (!messageId) throw new Error('evidence_source_message_missing');

  const { error } = await supabase.from('ai_payment_evidence').upsert({
    workspace_id: workspaceId,
    conversation_id: messageRow.conversation_id,
    message_id: messageId,
    provider_message_id: event.providerMessageId,
    media_kind: event.messageType,
    media_mime: String(event.mediaMime || '').split(';')[0].trim().toLowerCase(),
    status: 'candidate',
  }, { onConflict: 'workspace_id,message_id', ignoreDuplicates: true });
  if (error) throw error;
  return { staged: true, messageId };
}

/**
 * Somente leitura comercial: provas vinculadas NÃO entram no caixa real.
 * Comprovantes reconciliados deixam de contar como 'informado' para não
 * duplicar a entrada já representada por um recebimento confirmado.
 */
export function reportedPaymentSummary({ contractCents, cashReceipts = [], proofs = [] } = {}) {
  if (!Number.isSafeInteger(contractCents) || contractCents < 0) throw new TypeError('invalid_contract_cents');
  const confirmedCents = cashReceipts
    .filter((receipt) => !receipt.reversed && Number.isSafeInteger(receipt.amount_cents) && receipt.amount_cents > 0)
    .reduce((total, receipt) => total + receipt.amount_cents, 0);
  const unique = new Set();
  const informedCents = proofs.reduce((total, proof) => {
    const key = proof.message_id || proof.provider_message_id || proof.id;
    if (!key || unique.has(key)) return total;
    unique.add(key);
    if (proof.status !== 'matched' || !Number.isSafeInteger(proof.amount_cents) || proof.amount_cents <= 0) return total;
    return total + proof.amount_cents;
  }, 0);
  const reportedCents = confirmedCents + informedCents;
  return {
    contractCents, confirmedCents, informedCents, reportedCents,
    remainingReportedCents: Math.max(contractCents - reportedCents, 0),
    remainingConfirmedCents: Math.max(contractCents - confirmedCents, 0),
    overpaidReportedCents: Math.max(reportedCents - contractCents, 0),
  };
}
