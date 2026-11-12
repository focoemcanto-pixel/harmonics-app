/** Internal musician cost estimator, NOT a client quote or price list.
 * A professional is identified by a stable ID, never by their instrument.
 * Unknown identity or invalid hours blocks automatic cost approval.
 */
export function estimateReceptionMusicianCosts({ ceremonyIds = [], receptionIds = [], hours } = {}) {
  const h = Number(hours);
  if (!Number.isInteger(h) || h < 1 || h > 3) return { ok: false, reason: 'invalid_hours' };
  if (!Array.isArray(ceremonyIds) || !Array.isArray(receptionIds) || !receptionIds.length) {
    return { ok: false, reason: 'missing_roster' };
  }
  const valid = (id) => typeof id === 'string' && id.trim().length > 0;
  if (![...ceremonyIds, ...receptionIds].every(valid)) return { ok: false, reason: 'unknown_musician_identity' };
  if (new Set(receptionIds).size !== receptionIds.length || new Set(ceremonyIds).size !== ceremonyIds.length) {
    return { ok: false, reason: 'duplicate_musician_identity' };
  }
  const previous = new Set(ceremonyIds);
  const details = receptionIds.map(id => ({
    id,
    status: previous.has(id) ? 'continuing' : 'reception_only',
    internalCost: previous.has(id) ? h * 100 : 350 + (h - 1) * 100,
  }));
  return { ok: true, hours: h, details, totalInternalCost: details.reduce((s, x) => s + x.internalCost, 0),
    requiresClientPriceRule: true };
}
