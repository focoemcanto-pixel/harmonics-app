function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeArray(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => normalizeText(value))
        .filter(Boolean)
    )
  );
}

function extractYoutubeId(value) {
  const input = String(value || '').trim();
  if (!input) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

  try {
    const url = new URL(input);

    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.replace('/', '').trim();
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (url.hostname.includes('youtube.com')) {
      const fromQuery = url.searchParams.get('v');
      if (fromQuery && /^[a-zA-Z0-9_-]{11}$/.test(fromQuery)) return fromQuery;

      const pathPart = url.pathname.split('/').filter(Boolean).at(-1);
      return /^[a-zA-Z0-9_-]{11}$/.test(pathPart) ? pathPart : null;
    }
  } catch {
    return null;
  }

  return null;
}

function buildYoutubeUrl(youtubeId) {
  if (!youtubeId) return null;
  return `https://www.youtube.com/watch?v=${youtubeId}`;
}

function buildThumbnailUrl(youtubeId) {
  if (!youtubeId) return null;
  return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
}

function hasAnyKeyword(haystack, keywords) {
  return keywords.some((keyword) => haystack.includes(keyword));
}

function appendAll(target, values) {
  values.forEach((value) => {
    if (value) target.add(value);
  });
}

function inferArrays(song, matchedItems) {
  const bag = normalizeText([
    song?.title,
    song?.artist,
    song?.description,
    song?.youtube_url,
    ...matchedItems.map((item) => item?.moment),
    ...matchedItems.map((item) => item?.section),
    ...matchedItems.map((item) => item?.genres),
  ].join(' '));

  const eventTypes = new Set(normalizeArray(song?.event_types));
  const moments = new Set(normalizeArray(song?.moments));
  const styles = new Set(normalizeArray(song?.styles));
  const moods = new Set(normalizeArray(song?.moods));

  if (hasAnyKeyword(bag, ['casamento', 'wedding', 'noiva', 'noivo', 'cerimonia'])) {
    appendAll(eventTypes, ['casamento', 'cerimonia']);
  }

  if (hasAnyKeyword(bag, ['louvor', 'adoracao', 'worship', 'gospel', 'igreja'])) {
    appendAll(styles, ['worship']);
    appendAll(moods, ['leve', 'intimo']);
  }

  if (hasAnyKeyword(bag, ['acustic', 'acoustic', 'voz e violao', 'piano', 'soft'])) {
    appendAll(styles, ['acustico']);
    appendAll(moods, ['leve', 'intimo']);
  }

  if (hasAnyKeyword(bag, ['classica', 'classico', 'orquestra', 'instrumental', 'canon'])) {
    appendAll(styles, ['classico']);
    appendAll(moments, ['cerimonia', 'entrada']);
    appendAll(moods, ['solene']);
  }

  if (hasAnyKeyword(bag, ['entrada', 'cortejo'])) {
    appendAll(moments, ['entrada']);
  }

  if (hasAnyKeyword(bag, ['cerimonia', 'aliancas', 'altar'])) {
    appendAll(moments, ['cerimonia']);
  }

  if (hasAnyKeyword(bag, ['saida', 'encerramento', 'final'])) {
    appendAll(moments, ['saida']);
  }

  if (hasAnyKeyword(bag, ['receptivo', 'coquetel', 'jantar', 'recepcao'])) {
    appendAll(moments, ['receptivo']);
  }

  if (!moods.size) {
    appendAll(moods, ['emocionante']);
  }

  return {
    event_types: Array.from(eventTypes),
    moments: Array.from(moments),
    styles: Array.from(styles),
    moods: Array.from(moods),
  };
}

function pickTaxonomyId(rows, song, matchedItems, field) {
  if (song?.[field]) return song[field];

  const text = normalizeText([
    song?.title,
    song?.artist,
    song?.description,
    ...normalizeArray(song?.moments),
    ...normalizeArray(song?.styles),
    ...matchedItems.map((item) => item?.moment),
    ...matchedItems.map((item) => item?.section),
    ...matchedItems.map((item) => item?.genres),
  ].join(' '));

  const found = (rows || []).find((row) => {
    const name = normalizeText(row?.name);
    const slug = normalizeText(row?.slug);
    return (name && text.includes(name)) || (slug && text.includes(slug));
  });

  return found?.id || null;
}

function buildPriorityScore(song, metadata, usageCount, hasYoutube, hasThumb) {
  let score = 20;
  score += Math.min(usageCount, 20) * 2;
  if (hasYoutube) score += 12;
  if (hasThumb) score += 8;
  if (song?.genre_id) score += 8;
  if (song?.moment_id) score += 8;
  score += metadata.styles.length * 2;
  score += metadata.moods.length * 2;
  score += metadata.moments.length * 3;
  return Math.min(100, score);
}

export async function backfillSuggestionSongsMetadata(supabase, options = {}) {
  const log = options.logger || console;

  const [{ data: songs, error: songsError }, { data: genres, error: genresError }, { data: moments, error: momentsError }, { data: repertoireItems, error: repertoireError }] = await Promise.all([
    supabase
      .from('suggestion_songs')
      .select('id,title,artist,description,genre_id,moment_id,youtube_url,youtube_id,thumbnail_url,event_types,moments,styles,moods,priority_score,is_recommended,usage_count')
      .order('created_at', { ascending: true }),
    supabase.from('suggestion_genres').select('id,name,slug').eq('is_active', true),
    supabase.from('suggestion_moments').select('id,name,slug').eq('is_active', true),
    supabase
      .from('repertoire_items')
      .select('suggestion_song_id,song_name,artists,reference_link,reference_video_id,moment,section,genres,created_at'),
  ]);

  if (songsError) throw songsError;
  if (genresError) throw genresError;
  if (momentsError) throw momentsError;
  if (repertoireError) throw repertoireError;

  const songsList = songs || [];
  const repertoireList = repertoireItems || [];

  const updates = [];

  songsList.forEach((song) => {
    const songTitle = normalizeText(song?.title);
    const songArtist = normalizeText(song?.artist);

    const matchedItems = repertoireList.filter((item) => {
      if (item?.suggestion_song_id === song.id) return true;

      const itemVideoId = extractYoutubeId(item?.reference_video_id) || extractYoutubeId(item?.reference_link);
      if (itemVideoId && song?.youtube_id && itemVideoId === song.youtube_id) return true;

      const titleMatch = normalizeText(item?.song_name) === songTitle;
      const artistMatch = normalizeText(item?.artists) === songArtist;
      return titleMatch && (artistMatch || !songArtist);
    });

    const inferredYoutubeUrl =
      song?.youtube_url ||
      matchedItems.map((item) => String(item?.reference_link || '').trim()).find(Boolean) ||
      null;

    const inferredYoutubeId =
      extractYoutubeId(song?.youtube_id) ||
      extractYoutubeId(song?.youtube_url) ||
      extractYoutubeId(inferredYoutubeUrl) ||
      matchedItems.map((item) => extractYoutubeId(item?.reference_video_id) || extractYoutubeId(item?.reference_link)).find(Boolean) ||
      null;

    const inferredThumb =
      String(song?.thumbnail_url || '').trim() ||
      buildThumbnailUrl(inferredYoutubeId);

    const metadata = inferArrays(song, matchedItems);

    const inferredGenreId = pickTaxonomyId(genres, song, matchedItems, 'genre_id');
    const inferredMomentId = pickTaxonomyId(moments, song, matchedItems, 'moment_id');

    const usageCount = Math.max(Number(song?.usage_count || 0), matchedItems.length);

    const priorityScore = buildPriorityScore(
      { ...song, genre_id: song?.genre_id || inferredGenreId, moment_id: song?.moment_id || inferredMomentId },
      metadata,
      usageCount,
      Boolean(inferredYoutubeId || inferredYoutubeUrl),
      Boolean(inferredThumb)
    );

    const isRecommended = Boolean(
      songTitle &&
      songArtist &&
      (inferredYoutubeId || inferredYoutubeUrl) &&
      inferredThumb &&
      (song?.genre_id || inferredGenreId) &&
      (song?.moment_id || inferredMomentId) &&
      priorityScore >= 45
    );

    const nextPayload = {
      youtube_url: inferredYoutubeUrl || buildYoutubeUrl(inferredYoutubeId),
      youtube_id: inferredYoutubeId,
      thumbnail_url: inferredThumb,
      event_types: metadata.event_types,
      moments: metadata.moments,
      styles: metadata.styles,
      moods: metadata.moods,
      usage_count: usageCount,
      priority_score: priorityScore,
      is_recommended: isRecommended,
      genre_id: song?.genre_id || inferredGenreId,
      moment_id: song?.moment_id || inferredMomentId,
      updated_at: new Date().toISOString(),
    };

    const changed = [
      ['youtube_url', song?.youtube_url, nextPayload.youtube_url],
      ['youtube_id', song?.youtube_id, nextPayload.youtube_id],
      ['thumbnail_url', song?.thumbnail_url, nextPayload.thumbnail_url],
      ['usage_count', Number(song?.usage_count || 0), nextPayload.usage_count],
      ['priority_score', Number(song?.priority_score || 0), nextPayload.priority_score],
      ['is_recommended', Boolean(song?.is_recommended), nextPayload.is_recommended],
      ['genre_id', song?.genre_id || null, nextPayload.genre_id || null],
      ['moment_id', song?.moment_id || null, nextPayload.moment_id || null],
      ['event_types', JSON.stringify(normalizeArray(song?.event_types)), JSON.stringify(nextPayload.event_types)],
      ['moments', JSON.stringify(normalizeArray(song?.moments)), JSON.stringify(nextPayload.moments)],
      ['styles', JSON.stringify(normalizeArray(song?.styles)), JSON.stringify(nextPayload.styles)],
      ['moods', JSON.stringify(normalizeArray(song?.moods)), JSON.stringify(nextPayload.moods)],
    ].some(([, before, after]) => before !== after);

    if (changed) {
      updates.push({ id: song.id, payload: nextPayload });
    }
  });

  for (const update of updates) {
    const { error } = await supabase.from('suggestion_songs').update(update.payload).eq('id', update.id);
    if (error) throw error;
  }

  const stats = {
    scanned: songsList.length,
    updated: updates.length,
    unchanged: songsList.length - updates.length,
  };

  log.info?.('[sugestoes] enrichment done', stats);

  return stats;
}
