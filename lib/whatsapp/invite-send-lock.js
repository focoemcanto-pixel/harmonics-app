function createSendToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function clearStaleInviteSendLock({ supabaseAdmin, inviteId, eventId }) {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin
    .from('invites')
    .update({ sending_at: null, sending_token: null })
    .eq('id', inviteId)
    .eq('event_id', eventId)
    .is('whatsapp_sent_at', null)
    .lt('sending_at', cutoff);

  if (error) throw error;
}

export async function acquireInviteSendLock({ supabaseAdmin, inviteId, eventId, force = false }) {
  const token = createSendToken();

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

  const { data, error } = await query
    .select('id, sending_token')
    .maybeSingle();

  if (error) throw error;

  return {
    acquired: data?.sending_token === token,
    token: data?.sending_token === token ? token : null,
  };
}

export async function releaseInviteSendLock({ supabaseAdmin, inviteId, eventId, token, errorMessage = null }) {
  if (!token) return;

  const payload = {
    sending_at: null,
    sending_token: null,
  };

  if (errorMessage) payload.whatsapp_last_error = errorMessage;

  const { error } = await supabaseAdmin
    .from('invites')
    .update(payload)
    .eq('id', inviteId)
    .eq('event_id', eventId)
    .eq('sending_token', token);

  if (error) throw error;
}

export async function markInviteSentAndReleaseLock({ supabaseAdmin, invite, token }) {
  if (!token) return;

  const { error } = await supabaseAdmin
    .from('invites')
    .update({
      whatsapp_sent_at: new Date().toISOString(),
      whatsapp_send_count: Number(invite?.whatsapp_send_count || 0) + 1,
      whatsapp_last_error: null,
      sending_at: null,
      sending_token: null,
    })
    .eq('id', invite.id)
    .eq('event_id', invite.event_id)
    .eq('sending_token', token);

  if (error) throw error;
}
