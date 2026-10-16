// Reserva atômica de envio (automation_dispatch_claims, unique(workspace_id, dedupe_key)).
// sending -> sent | failed. Só "failed" pode ser reivindicado de novo (retry após erro
// explícito do provider). Uma execução que cai entre o aceite do provider e a marcação
// deixa "sending": no máximo um envio, nunca dois.

const TABLE = 'automation_dispatch_claims';

function isMissingTable(error) {
  const message = String(error?.message || '');
  return error?.code === '42P01' || error?.code === 'PGRST205' || message.includes(TABLE);
}

export async function acquireDispatchClaim({ supabase, workspaceId, dedupeKey, eventType, ruleId, entityType, entityId }) {
  if (!dedupeKey || !workspaceId) return { acquired: true, claimId: null, reason: 'no_key' };
  const now = new Date().toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from(TABLE)
    .insert({
      workspace_id: workspaceId,
      dedupe_key: dedupeKey,
      event_type: eventType,
      rule_id: ruleId || null,
      entity_type: entityType || null,
      entity_id: entityId ? String(entityId) : null,
      status: 'sending',
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (!insertError && inserted?.id) return { acquired: true, claimId: inserted.id, reason: 'claimed' };

  if (insertError && isMissingTable(insertError)) {
    console.warn('[automation][claims] tabela de reservas ausente; seguindo só com a checagem de logs.');
    return { acquired: true, claimId: null, reason: 'legacy_schema' };
  }

  if (insertError?.code !== '23505') throw insertError;

  // Já existe reserva: só uma falha anterior pode ser retomada (atômico: WHERE status = 'failed').
  const { data: retaken, error: retakeError } = await supabase
    .from(TABLE)
    .update({ status: 'sending', last_error: null, updated_at: now })
    .eq('workspace_id', workspaceId)
    .eq('dedupe_key', dedupeKey)
    .eq('status', 'failed')
    .select('id')
    .maybeSingle();
  if (retakeError) throw retakeError;
  if (retaken?.id) return { acquired: true, claimId: retaken.id, reason: 'retry_after_failure' };

  return { acquired: false, claimId: null, reason: 'already_sent_or_in_progress' };
}

export async function finishDispatchClaim({ supabase, claimId, status, logId = null, error = null }) {
  if (!claimId) return;
  const { error: updateError } = await supabase
    .from(TABLE)
    .update({
      status,
      log_id: logId || null,
      last_error: error ? String(error).slice(0, 500) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', claimId)
    .eq('status', 'sending');
  if (updateError) {
    console.error('[automation][claims] falha ao finalizar reserva', { claimId, status, error: updateError.message });
  }
}
