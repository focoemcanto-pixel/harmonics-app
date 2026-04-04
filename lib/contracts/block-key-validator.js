/**
 * Validação e normalização de block_key
 */

export function isValidBlockKey(blockKey) {
  if (!blockKey || typeof blockKey !== 'string') return false;
  const regex = /^[a-z][a-z0-9_]*$/;
  return regex.test(blockKey);
}

export function normalizeBlockKey(input) {
  if (!input) return '';
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '')
    .replace(/^[0-9]+/, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}
