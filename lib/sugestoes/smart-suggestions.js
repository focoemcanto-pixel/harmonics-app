const SECTION_KEYS = ['entrada', 'cerimonia', 'receptivo', 'saida'];

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  return [];
}

function scoreByMatch(songList, eventValue, weight, reason) {
  if (!songList.length || !eventValue) return { points: 0, reason: null };
  if (!songList.includes(normalizeText(eventValue))) return { points: 0, reason: null };
  return { points: weight, reason };
}

function inferSectionFromMoments(moments = []) {
  if (moments.includes('entrada') || moments.includes('cortejo')) return 'entrada';
  if (moments.includes('cerimonia')) return 'cerimonia';
  if (moments.includes('receptivo') || moments.includes('coquetel')) return 'receptivo';
  if (moments.includes('saida')) return 'saida';
  return 'cerimonia';
}

function buildScore(song, event) {
  const reasons = [];
  let score = 0;

  const eventTypes = normalizeList(song.event_types);
  const moments = normalizeList(song.moments);
  const styles = normalizeList(song.styles);
  const moods = normalizeList(song.moods);

  const eventTypeMatch = scoreByMatch(
    eventTypes,
    event?.event_type,
    30,
    'Compatível com o tipo de evento'
  );
  score += eventTypeMatch.points;
  if (eventTypeMatch.reason) reasons.push(eventTypeMatch.reason);

  const momentMatch = scoreByMatch(
    moments,
    event?.targetMoment,
    25,
    'Combina com o momento solicitado'
  );
  score += momentMatch.points;
  if (momentMatch.reason) reasons.push(momentMatch.reason);

  const styleMatch = scoreByMatch(styles, event?.style, 16, 'Alinhada ao estilo musical');
  score += styleMatch.points;
  if (styleMatch.reason) reasons.push(styleMatch.reason);

  const moodMatch = scoreByMatch(moods, event?.mood, 14, 'Clima musical adequado');
  score += moodMatch.points;
  if (moodMatch.reason) reasons.push(moodMatch.reason);

  if (song.is_featured || song.is_recommended) {
    score += 8;
    reasons.push('Música em destaque no catálogo');
  }

  const usageCount = Number(song.usage_count || 0);
  if (usageCount > 0) {
    score += Math.min(usageCount, 12);
    reasons.push('Boa aceitação em eventos anteriores');
  }

  const priority = Number(song.priority_score || 0);
  if (priority > 0) {
    score += Math.min(priority, 20);
    reasons.push('Prioridade editorial do catálogo');
  }

  return { score, reasons, section: inferSectionFromMoments(moments) };
}

export function getSmartSuggestionsForEvent(event, catalog = []) {
  const base = Array.isArray(catalog) ? catalog : [];

  const scored = base
    .filter((song) => song && song.is_active !== false)
    .map((song) => {
      const scoredSong = buildScore(song, event || {});
      return {
        ...song,
        score: scoredSong.score,
        reason: scoredSong.reasons.join(' • '),
        section: scoredSong.section,
      };
    })
    .sort((a, b) => b.score - a.score || String(a.title || '').localeCompare(String(b.title || '')));

  const bySection = SECTION_KEYS.reduce((acc, section) => {
    acc[section] = scored.filter((song) => song.section === section).slice(0, 6);
    return acc;
  }, {});

  return {
    entrada: bySection.entrada,
    cerimonia: bySection.cerimonia,
    receptivo: bySection.receptivo,
    saida: bySection.saida,
    all: scored,
  };
}

export { SECTION_KEYS };
