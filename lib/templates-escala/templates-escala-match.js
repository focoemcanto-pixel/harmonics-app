export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function splitCsvLike(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function scoreInstruments(templateInstruments, eventInstruments) {
  const templateTokens = splitCsvLike(templateInstruments).map(normalizeText);
  const eventTokens = splitCsvLike(eventInstruments).map(normalizeText);

  if (templateTokens.length === 0 || eventTokens.length === 0) return 0;

  let score = 0;

  for (const token of templateTokens) {
    if (eventTokens.includes(token)) score += 3;
    else if (eventTokens.some((ev) => ev.includes(token) || token.includes(ev))) score += 1;
  }

  return score;
}

export function pickBestScaleTemplate(templates, eventFormation, eventInstruments) {
  const formationNormalized = normalizeText(eventFormation);

  const candidates = (templates || []).filter(
    (template) =>
      template.is_active !== false &&
      normalizeText(template.formation) === formationNormalized
  );

  if (candidates.length === 0) return null;

  const ranked = candidates
    .map((template) => ({
      template,
      score: scoreInstruments(template.instruments, eventInstruments),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.template.name || '').localeCompare(String(b.template.name || ''));
    });

  return ranked[0]?.template || null;
}