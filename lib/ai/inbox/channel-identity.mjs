/**
 * A identidade de um canal Meta é formada pelos IDs, token e número exibido.
 * Uma verificação de Coexistência pertence SOMENTE à identidade consultada.
 * Nenhuma decisão aqui consulta a Meta ou ativa a IA.
 */
const normalized = (value) => String(value ?? '').trim();
const phoneDigits = (value) => normalized(value).replace(/\D/g, '');

export function channelIdentityChanged(existing, fields = {}, { tokenRotated = false } = {}) {
  if (!existing) return true;
  if (tokenRotated) return true;
  for (const field of ['phone_number_id', 'waba_id']) {
    if (Object.hasOwn(fields, field) && normalized(fields[field]) !== normalized(existing[field])) return true;
  }
  // Número exibido não é credencial, mas não pode mostrar "número novo"
  // conservando selo de Coexistência conferido para o número antigo.
  if (Object.hasOwn(fields, 'display_phone') &&
      phoneDigits(fields.display_phone) !== phoneDigits(existing.display_phone)) return true;
  return false;
}

export function prepareChannelIdentityUpdate({ existing = null, fields = {}, tokenRotated = false } = {}) {
  const changed = channelIdentityChanged(existing, fields, { tokenRotated });
  if (!changed) return { identityChanged: false, fields: { ...fields } };
  return {
    identityChanged: true,
    fields: {
      ...fields,
      coexistence: false,
      last_eligibility: null,
      history_sync_status: 'not_requested',
      last_webhook_at: null,
      // Falha fechada: a troca de número/token nunca liga outro canal.
      status: 'paused',
    },
  };
}

/** Força mudança monotônica, mesmo se duas atualizações caírem no mesmo milissegundo. */
export function nextChannelRevision(previous, now = Date.now()) {
  const old = new Date(previous || 0).getTime();
  return new Date(Math.max(now, Number.isFinite(old) ? old + 1 : now)).toISOString();
}
