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

/**
 * Compare-and-swap no PostgREST: não grava resultado de uma versão anterior
 * sobre credenciais atualizadas. Retorna data:null quando houve conflito.
 * Todas as mutações de identidade e elegibilidade devem passar por este gate.
 */
export async function updateChannelIfCurrent({
  supabase, workspaceId, channel, changes, matchPhone = false,
} = {}) {
  let query = supabase.from('ai_channels')
    .update({ ...changes, updated_at: nextChannelRevision(channel.updated_at) })
    .eq('id', channel.id)
    .eq('workspace_id', workspaceId)
    .eq('provider', 'meta_cloud')
    .eq('updated_at', channel.updated_at);
  if (matchPhone) query = query.eq('phone_number_id', channel.phone_number_id);
  return query.select('id').maybeSingle();
}

/** Restrict the initial supervised pilot to the verified business and authorized test chats. */
export function supervisedPilotEligible({ channel, chatId, env, now = Date.now() }) {
  const verified = channel?.last_eligibility;
  const age = now - Date.parse(verified?.checked_at);
  const expected = phoneDigits(env.NARA_PILOT_BUSINESS_PHONE);
  const recipient = phoneDigits(chatId);
  const contacts = String(env.NARA_PILOT_CONTACTS || '').split(',').map(phoneDigits);
  return env.NARA_V2_SUPERVISED === 'true' && channel?.coexistence === true &&
    verified?.ok === true && verified.isOnBizApp === true &&
    Number.isFinite(age) && age >= 0 && age < 24 * 60 * 60 * 1000 &&
    /^\d{8,15}$/.test(expected) && expected === phoneDigits(verified.displayPhone) &&
    expected === phoneDigits(channel.display_phone) &&
    /^\d{8,15}$/.test(recipient) && contacts.includes(recipient);
}
