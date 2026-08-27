function isMissingLockColumn(error) {
  const message = String(error?.message || error?.details || '');
  return (
    error?.code === 'PGRST204' &&
    (message.includes("'sending_at'") || message.includes("'sending_token'"))
  );
}

// O lock sending_at/sending_token foi introduzido depois da tabela invites original.
// Alguns ambientes de produção ainda não possuem essas colunas no schema cache.
// O whatsapp_sent_at já é o marcador persistente de deduplicação e continua sendo
// a fonte de verdade. Se as colunas de lock não existirem, não bloqueamos o envio.
export async function clearStaleInviteSendLock({ supabaseAdmin, inviteId, eventId }) {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin
    .from('invites')
    .update({ sending_at: null, sending_token: null })
    .eq('id', inviteId)
    .eq('event_id', eventId)
    .is('whatsapp_sent_at', null)
    .lt('sending_at', cutoff);

  if (error && !isMissingLockColumn(error)) throw error;
}

export async function acquireInviteSendLock({ supabaseAdmin, inviteId, eventId, force = false }) {
  const token = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  let query = supabaseAdmin
    .from('invites')
    .update({
      sending_at: new Date().toISOString(),
      sending_token: token,
      whatsapp_last_error: null,
    })
    .eq('id', inviteId)
    .eq('event_id', eventId)
    .neq('status', 'removed')
    .is('sending_at', null);

  if (!force) query = query.is('whatsapp_sent_at', null);

  const { data, error } = await query.select('id, sending_token').maybeSingle();

  if (error) {
    if (isMissingLockColumn(error)) {
      // Compatibilidade com produção sem a migration do lock. O serviço já faz
      // uma segunda leitura de whatsapp_sent_at imediatamente antes deste ponto.
      return { acquired: true, token: null, legacySchema: true };
    }
    throw error;
  }

  return {
    acquired: data?.sending_token === token,
    token: data?.sending_token === token ? token : null,
    legacySchema: false,
  };
}

export async function releaseInviteSendLock({ supabaseAdmin, inviteId, eventId, token, errorMessage = null }) {
  if (!token) return;

  const payload = { sending_at: null, sending_token: null };
  if (errorMessage) payload.whatsapp_last_error = errorMessage;

  const { error } = await supabaseAdmin
    .from('invites')
    .update(payload)
    .eq('id', inviteId)
    .eq('event_id', eventId)
    .eq('sending_token', token);

  if (error && !isMissingLockColumn(error)) throw error;
}

export async function markInviteSentAndReleaseLock({ supabaseAdmin, invite, token }) {
  const basePayload = {
    whatsapp_sent_at: new Date().toISOString(),
    whatsapp_send_count: Number(invite?.whatsapp_send_count || 0) + 1,
    whatsapp_last_error: null,
  };

  // Schema legado: não há token porque não existem as colunas sending_*.
  if (!token) {
    const { error } = await supabaseAdmin
      .from('invites')
      .update(basePayload)
      .eq('id', invite.id)
      .eq('event_id', invite.event_id);
    if (error) throw error;
    return;
  }

  const { error } = await supabaseAdmin
    .from('invites')
    .update({ ...basePayload, sending_at: null, sending_token: null })
    .eq('id', invite.id)
    .eq('event_id', invite.event_id)
    .eq('sending_token', token);

  if (error) {
    if (!isMissingLockColumn(error)) throw error;
    const { error: fallbackError } = await supabaseAdmin
      .from('invites')
      .update(basePayload)
      .eq('id', invite.id)
      .eq('event_id', invite.event_id);
    if (fallbackError) throw fallbackError;
  }
}
