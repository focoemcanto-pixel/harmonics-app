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
  if (precontract?.expires_at) {
    const explicit = new Date(precontract.expires_at);
    if (!Number.isNaN(explicit.getTime())) return explicit;
  }
  const createdAt = precontract?.created_at ? new Date(precontract.created_at) : null;
  if (!createdAt || Number.isNaN(createdAt.getTime())) return null;
  const expiresAt = new Date(createdAt);
  expiresAt.setDate(expiresAt.getDate() + expirationDays);
  return expiresAt;
}

export function buildPrecontractValidityRenewal(precontract, now = new Date()) {
  const status = normalizePrecontractStatus(precontract?.status);
  if (ACTIVE_FINAL_STATUSES.has(status) && status !== EXPIRED_STATUS) {
    throw new Error('Somente pré-contratos não assinados e ativos ou expirados podem ter a validade renovada.');
  }
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + getPrecontractExpirationDays());
  return { expires_at: expiresAt.toISOString(), ...(status === EXPIRED_STATUS ? { status: 'link_generated' } : {}) };
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

  let query = supabase.from('precontracts').update({ status: EXPIRED_STATUS })
    .eq('id', precontract.id).eq('status', precontract.status);
  query = precontract.expires_at ? query.eq('expires_at', precontract.expires_at) : query.is('expires_at', null);
  const { data, error } = await query.select('*').maybeSingle();

  if (error) throw error;

  if (!data) {
    const current = await supabase.from('precontracts').select('*').eq('id', precontract.id).single();
    if (current.error) throw current.error;
    return { expired: isPrecontractExpiredStatus(current.data), precontract: current.data, changed: false };
  }
  return { expired: true, precontract: data, changed: true };
}

export async function expireOldPrecontractsForWorkspace({ supabase, workspaceId, limit = 200 } = {}) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - getPrecontractExpirationDays());

  let query = supabase
    .from('precontracts')
    .select('id, status, created_at, expires_at, workspace_id')
    .or(`expires_at.lte.${new Date().toISOString()},and(expires_at.is.null,created_at.lt.${cutoff.toISOString()})`)
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

  const results = await Promise.all((data || []).filter(item => ids.includes(item.id))
    .map(precontract => expirePrecontractIfNeeded({ supabase, precontract })));
  const changed = results.filter(result => result.changed).map(result => result.precontract.id);
  return { expiredCount: changed.length, ids: changed };
}
