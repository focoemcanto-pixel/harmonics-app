export function normalizeTimeStrict(value) {
  if (!value) return '';

  const str = String(value).trim();
  const match = str.match(/^(\d{2}:\d{2})/);

  if (match) return match[1];

  return '';
}

export function isValidTime(value) {
  const normalized = normalizeTimeStrict(value);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(normalized);
}

export function sanitizeTimeFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  return {
    ...obj,
    event_time: normalizeTimeStrict(obj.event_time),
    horario: normalizeTimeStrict(obj.horario),
  };
}

// Backward-compatible alias for existing imports.
export const normalizeTime = normalizeTimeStrict;
