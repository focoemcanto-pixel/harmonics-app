const DEFAULT_EXPIRATION_DAYS = 7;
const EXPIRED_STATUS = 'expired';
const SIGNED_STATUSES = new Set(['signed', 'assinado']);
const ACTIVE_FINAL_STATUSES = new Set(['signed', 'assinado', EXPIRED_STATUS, 'cancelled', 'canceled', 'archived', 'arquivado']);

export const PRECONTRACT_EXPIRED_MESSAGE = 'Esse contrato foi expirado, solicite um novo.';

export function getPrecontractExpirationDays() {
  const raw = Number(process.env.PRECONTRACT_EXPIRATION_DAYS || DEFAULT_EXPIRATION_DAYS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_EXPIRATION_DAYS;
  return Math.trunc(raw);
}

export function normalizePrecontractStatus(value) {
  return String(value || '').trim().toLowerCase();
}

export function isPrecontractSigned(precontract) {
  return SIGNED_STATUSES.has(normalizePrecontractStatus(precontract?.status));
}

export function isPrecontractExpiredStatus(precontract) {
  return normalizePrecontractStatus(precontract?.status) === EXPIRED_STATUS;
}

export function isPrecontractExpirable(precontract) {
  const status = normalizePrecontractStatus(precontract?.status);
  return !ACTIVE_FINAL_STATUSES.has(status);
}

export function getPrecontractExpirationDate(precontract, expirationDays = getPrecontractExpirationDays()) {
  const createdAt = precontract?.created_at ? new Date(precontract.created_at) : null;
  if (!createdAt || Number.isNaN(createdAt.getTime())) return null;
  const expiresAt = new Date(createdAt);
  expiresAt.setDate(expiresAt.getDate() + expirationDays);
  return expiresAt;
}

export function isPrecontractExpiredByAge(precontract, now = new Date()) {
  if (!isPrecontractExpirable(precontract)) return false;
  const expiresAt = getPrecontractExpirationDate(precontract);
  if (!expiresAt) return false;
  return now.getTime() >= expiresAt.getTime();
}

export async function expirePrecontractIfNeeded({ supabase, precontract, now = new Date() }) {
  if (!precontract?.id) {
    return { expired: false, precontract: null, changed: false };
  }

  if (isPrecontractExpiredStatus(precontract)) {
    return { expired: true, precontract, changed: false };
  }

  if (isPrecontractSigned(precontract)) {
    return { expired: false, precontract, changed: false };
  }

  if (!isPrecontractExpiredByAge(precontract, now)) {
    return { expired: false, precontract, changed: false };
  }

  const { data, error } = await supabase
    .from('precontracts')
    .update({ status: EXPIRED_STATUS })
    .eq('id', precontract.id)
    .select('*')
    .maybeSingle();

  if (error) throw error;

  return {
    expired: true,
    precontract: data || { ...precontract, status: EXPIRED_STATUS },
    changed: true,
  };
}

export async function expireOldPrecontractsForWorkspace({ supabase, workspaceId, limit = 200 } = {}) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - getPrecontractExpirationDays());

  let query = supabase
    .from('precontracts')
    .select('id, status, created_at, workspace_id')
    .lt('created_at', cutoff.toISOString())
    .limit(limit);

  if (workspaceId) query = query.eq('workspace_id', workspaceId);

  const { data, error } = await query;
  if (error) throw error;

  const ids = (data || [])
    .filter((item) => isPrecontractExpirable(item))
    .map((item) => item.id);

  if (ids.length === 0) {
    return { expiredCount: 0, ids: [] };
  }

  const { data: updated, error: updateError } = await supabase
    .from('precontracts')
    .update({ status: EXPIRED_STATUS })
    .in('id', ids)
    .select('id');

  if (updateError) throw updateError;

  return {
    expiredCount: Array.isArray(updated) ? updated.length : ids.length,
    ids: (updated || []).map((item) => item.id),
  };
}
