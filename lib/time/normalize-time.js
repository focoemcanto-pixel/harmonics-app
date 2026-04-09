export function normalizeTime(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}
