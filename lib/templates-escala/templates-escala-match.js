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

function scoreTags(templateTags, eventTags) {
  const templateTokens = splitCsvLike(templateTags).map(normalizeText);
  const eventTokens = splitCsvLike(eventTags).map(normalizeText);

  if (templateTokens.length === 0 || eventTokens.length === 0) return 0;

  let score = 0;

  for (const token of templateTokens) {
    if (eventTokens.includes(token)) score += 2;
    else if (eventTokens.some((ev) => ev.includes(token) || token.includes(ev))) score += 1;
  }

  return score;
}

function getTemplatePriority(template) {
  const value =
    template?.suggestion_priority ??
    template?.priority ??
    template?.sort_order ??
    999;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 999;
}

export function pickBestScaleTemplate(templates, eventFormation, eventInstruments, eventTags) {
  const formationNormalized = normalizeText(eventFormation);

  const candidates = (templates || []).filter(
    (template) =>
      template.is_active !== false &&
      normalizeText(template.formation) === formationNormalized
  );

  if (candidates.length === 0) return { template: null, strategy: 'none' };

  const ranked = candidates.map((template) => ({
    template,
    instrumentScore: scoreInstruments(template.instruments, eventInstruments),
    tagScore: scoreTags(template.compatible_tags, eventTags),
    priority: getTemplatePriority(template),
  }));

  const exact = ranked
    .filter((item) => item.instrumentScore > 0)
    .sort((a, b) => {
      if (b.instrumentScore !== a.instrumentScore) return b.instrumentScore - a.instrumentScore;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return String(a.template.name || '').localeCompare(String(b.template.name || ''));
    });
  if (exact.length > 0) return { template: exact[0].template, strategy: 'formation_instruments' };

  const byTags = ranked
    .filter((item) => item.tagScore > 0)
    .sort((a, b) => {
      if (b.tagScore !== a.tagScore) return b.tagScore - a.tagScore;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return String(a.template.name || '').localeCompare(String(b.template.name || ''));
    });
  if (byTags.length > 0) return { template: byTags[0].template, strategy: 'formation_tags' };

  const byFormation = ranked
    .map((template) => ({
      template: template.template,
      priority: template.priority,
    }))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return String(a.template.name || '').localeCompare(String(b.template.name || ''));
    });

  return { template: byFormation[0]?.template || null, strategy: 'formation_only' };
}
