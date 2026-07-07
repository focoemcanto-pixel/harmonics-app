import { buildRepertoirePdfHtml as buildBaseRepertoirePdfHtml } from '@/lib/repertorio/buildRepertoirePdfHtml';

function compactText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeCompare(value) {
  return compactText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isGenericEntranceLabel(value) {
  const normalized = normalizeCompare(value);
  return !normalized || normalized === 'entrada' || normalized === 'cortejo' || normalized === 'momento musical';
}

function fallbackEntranceLabel(index) {
  const defaults = [
    'Entrada dos padrinhos',
    'Entrada do noivo',
    'Entrada de pais, damas ou pajens',
    'Entrada da noiva',
    'Entrada das alianças',
    'Entrada especial',
  ];
  return defaults[index] || `Entrada ${index + 1}`;
}

function resolveCortejoLabel(item = {}, index = 0) {
  const candidates = [item?.label, item?.who_enters, item?.moment, item?.group_name]
    .map(compactText)
    .filter(Boolean);

  const specific = candidates.find((candidate) => !isGenericEntranceLabel(candidate));
  if (specific) return specific;

  return fallbackEntranceLabel(index);
}

function normalizeCortejoItemsForPdf(items = []) {
  let cortejoIndex = 0;

  return (Array.isArray(items) ? items : []).map((item) => {
    if (normalizeCompare(item?.section) !== 'cortejo') return item;

    const label = resolveCortejoLabel(item, cortejoIndex);
    cortejoIndex += 1;

    return {
      ...item,
      label,
      who_enters: label,
      moment: label,
    };
  });
}

export function buildRepertoirePdfHtml(payload = {}) {
  return buildBaseRepertoirePdfHtml({
    ...payload,
    items: normalizeCortejoItemsForPdf(payload?.items),
  });
}
