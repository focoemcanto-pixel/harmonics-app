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
    .split(/[;,|/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueNormalizedTokens(value) {
  return Array.from(new Set(splitCsvLike(value).map(normalizeText).filter(Boolean)));
}

function tokenMatchScore(expected, actual) {
  if (!expected || !actual) return 0;
  if (expected === actual) return 1;
  if (actual.includes(expected) || expected.includes(actual)) return 0.5;
  return 0;
}

function getTemplatePriority(template) {
  const raw = template?.suggestion_priority ?? template?.priority ?? template?.sort_order ?? 999;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 999;
}

function buildExplanation(parts) {
  return parts.filter(Boolean).join(' • ');
}

export function matchTemplatesForEvent(event, templates) {
  const eventFormation = normalizeText(event?.formation);
  const eventInstruments = uniqueNormalizedTokens(event?.instruments);
  const eventTags = uniqueNormalizedTokens(event?.roleInstrumentTags || event?.compatible_tags || '');

  const ranked = [];

  for (const template of templates || []) {
    if (template?.is_active === false) continue;

    const templateFormation = normalizeText(template?.formation);

    if (!eventFormation || !templateFormation || templateFormation !== eventFormation) {
      continue;
    }

    const templateInstruments = uniqueNormalizedTokens(template?.instruments);
    const templateTags = uniqueNormalizedTokens(template?.compatible_tags);

    let score = 0;
    let instrumentMatches = 0;
    let tagMatches = 0;
    let missingRelevant = 0;
    let incompatibilities = 0;

    for (const token of eventInstruments) {
      const hasInstrument = templateInstruments.some((candidate) => tokenMatchScore(token, candidate) > 0);
      const hasTag = templateTags.some((candidate) => tokenMatchScore(token, candidate) > 0);

      if (hasInstrument || hasTag) {
        instrumentMatches += 1;
        score += 3;
      } else {
        missingRelevant += 1;
        score -= 3;
      }
    }

    for (const tag of eventTags) {
      const hasTag = templateTags.some((candidate) => tokenMatchScore(tag, candidate) > 0);
      if (hasTag) {
        tagMatches += 1;
        score += 2;
      } else {
        missingRelevant += 1;
        score -= 3;
      }
    }

    const eventContext = [...eventInstruments, ...eventTags];
    const unmatchedTemplateSignals = [...templateInstruments, ...templateTags].filter(
      (signal) => !eventContext.some((ctx) => tokenMatchScore(signal, ctx) > 0)
    );
    if (unmatchedTemplateSignals.length > 0) {
      incompatibilities = unmatchedTemplateSignals.length;
      score -= 3;
    }

    const requiredSignals = Array.from(new Set([...eventInstruments, ...eventTags]));
    const coveredSignals = requiredSignals.filter((signal) => {
      const inInstruments = templateInstruments.some((candidate) => tokenMatchScore(signal, candidate) > 0);
      const inTags = templateTags.some((candidate) => tokenMatchScore(signal, candidate) > 0);
      return inInstruments || inTags;
    });

    const hasFullCoverage = requiredSignals.length > 0 && coveredSignals.length === requiredSignals.length;
    if (hasFullCoverage) score += 5;

    const priority = getTemplatePriority(template);

    ranked.push({
      template,
      score,
      priority,
      explanation: buildExplanation([
        `Formação compatível: ${template?.formation || '-'}`,
        instrumentMatches > 0 ? `${instrumentMatches} função(ões)/instrumento(s) compatível(is)` : 'Sem match de funções/instrumentos',
        tagMatches > 0 ? `${tagMatches} tag(s) compatível(is)` : '',
        hasFullCoverage ? 'Cobertura completa (+5)' : '',
        missingRelevant > 0 ? `${missingRelevant} lacuna(s) relevante(s) (-3 cada)` : '',
        incompatibilities > 0 ? 'Incompatibilidade evidente (-3)' : '',
      ]),
    });
  }

  const ordered = ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return String(a.template?.name || '').localeCompare(String(b.template?.name || ''));
  });

  const best = ordered[0] || null;

  return {
    bestTemplate: best?.template || null,
    suggestions: ordered,
    strategy: best ? 'formation_weighted_score' : 'none',
  };
}
