const INSTRUMENT_EQUIVALENCE_RULES = [
  {
    canonical: 'teclado',
    aliases: ['teclado', 'tecladista', 'piano', 'pianista', 'keys', 'keyboard'],
  },
  {
    canonical: 'violino',
    aliases: ['violino', 'violinista', 'violin'],
  },
  {
    canonical: 'violao',
    aliases: ['violao', 'violonista', 'guitarra acustica', 'guitar'],
  },
  {
    canonical: 'guitarra',
    aliases: ['guitarra', 'guitarrista'],
  },
  {
    canonical: 'sax',
    aliases: ['sax', 'saxofone', 'saxofonista'],
  },
  {
    canonical: 'voz masculina',
    aliases: ['voz masculina', 'vocal masculino', 'cantor masculino', 'voz homem', 'masculino'],
  },
  {
    canonical: 'voz feminina',
    aliases: ['voz feminina', 'vocal feminino', 'cantora feminina', 'voz mulher', 'feminino'],
  },
  {
    canonical: 'voz',
    aliases: ['voz', 'vocal', 'cantor', 'cantora', 'solo vocal'],
  },
];

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeInstrumentToken(value) {
  const normalized = normalizeText(value);
  if (!normalized) return '';

  for (const rule of INSTRUMENT_EQUIVALENCE_RULES) {
    if (rule.aliases.some((alias) => normalized === alias || normalized.includes(alias))) {
      return rule.canonical;
    }
  }

  return normalized;
}

export function splitCsvLike(value) {
  if (!value) return [];

  const normalized = normalizeText(value)
    .replace(/voz masculina\s+e\s+feminina/g, 'voz masculina, voz feminina')
    .replace(/vocal masculino\s+e\s+feminino/g, 'vocal masculino, vocal feminino')
    .replace(/voz feminina\s+e\s+masculina/g, 'voz feminina, voz masculina')
    .replace(/vocal feminino\s+e\s+masculino/g, 'vocal feminino, vocal masculino')
    .replace(/teclado\s+e\s+piano/g, 'teclado')
    .replace(/piano\s+e\s+teclado/g, 'teclado');

  return normalized
    .split(/[;,|/]|\s+e\s+/)
    .map((item) => normalizeInstrumentToken(item))
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);
}

function scoreInstruments(templateInstruments, eventInstruments) {
  const templateTokens = splitCsvLike(templateInstruments);
  const eventTokens = splitCsvLike(eventInstruments);

  if (templateTokens.length === 0 || eventTokens.length === 0) return 0;

  let score = 0;

  for (const token of templateTokens) {
    if (eventTokens.includes(token)) score += 3;
    else if (eventTokens.some((ev) => ev.includes(token) || token.includes(ev))) score += 1;
  }

  return score;
}

function scoreTags(templateTags, eventTags) {
  const templateTokens = splitCsvLike(templateTags);
  const eventTokens = splitCsvLike(eventTags);

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

export function pickBestScaleTemplate(
  templates,
  eventFormation,
  eventInstruments,
  eventRoleInstrumentTags
) {
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
    tagScore: scoreTags(template.compatible_tags, eventRoleInstrumentTags),
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
