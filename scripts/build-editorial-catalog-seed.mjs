#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function parseArgs(argv) {
  const args = { input: null, outJson: null, outSql: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') args.input = argv[i + 1];
    if (arg === '--out-json') args.outJson = argv[i + 1];
    if (arg === '--out-sql') args.outSql = argv[i + 1];
  }
  return args;
}

function readInput(inputPath) {
  if (inputPath) {
    return fs.readFileSync(path.resolve(process.cwd(), inputPath), 'utf8');
  }
  const stdin = fs.readFileSync(0, 'utf8');
  if (!stdin.trim()) {
    throw new Error('Nenhum conteúdo recebido. Use --input arquivo.txt ou pipe via STDIN.');
  }
  return stdin;
}

function cleanRaw(raw) {
  return raw.replace(/```(?:json|js|javascript)?/gi, '').replace(/```/g, '').trim();
}

function tryJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function tryExpressionParse(raw) {
  try {
    return vm.runInNewContext(`(${raw})`, {}, { timeout: 500 });
  } catch {
    return null;
  }
}

function tryScriptParse(raw) {
  const context = {};
  vm.createContext(context);
  const captureScript = `
${raw}

globalThis.__capture = {
  featuredCollections: typeof featuredCollections !== 'undefined' ? featuredCollections : undefined,
  songs: typeof songs !== 'undefined' ? songs : undefined,
  filters: typeof filters !== 'undefined' ? filters : undefined,
  catalog: typeof catalog !== 'undefined' ? catalog : undefined,
  data: typeof data !== 'undefined' ? data : undefined,
  categories: typeof categories !== 'undefined' ? categories : undefined,
  gospelCerimonia: typeof gospelCerimonia !== 'undefined' ? gospelCerimonia : undefined,
  gospelModerno: typeof gospelModerno !== 'undefined' ? gospelModerno : undefined
};`;

  try {
    vm.runInContext(captureScript, context, { timeout: 1000 });
    return context.__capture;
  } catch {
    return null;
  }
}

function parseLegacyInput(raw) {
  const cleaned = cleanRaw(raw);
  return tryJsonParse(cleaned) || tryExpressionParse(cleaned) || tryScriptParse(cleaned);
}

function normalizeText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'sim'].includes(lower)) return true;
    if (['false', '0', 'no', 'nao', 'não'].includes(lower)) return false;
  }
  return fallback;
}

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function extractYoutubeId(value) {
  const text = normalizeText(value);
  if (!text) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(text)) return text;

  try {
    const url = new URL(text);
    if (url.hostname.includes('youtu.be')) {
      const candidate = url.pathname.replace(/^\//, '').slice(0, 11);
      return candidate || null;
    }
    if (url.hostname.includes('youtube.com')) {
      const fromV = url.searchParams.get('v');
      if (fromV) return fromV.slice(0, 11);
      const parts = url.pathname.split('/').filter(Boolean);
      const last = parts.at(-1);
      if (last && last.length >= 11) return last.slice(0, 11);
    }
  } catch {
    return null;
  }
  return null;
}

function inferSourceBlock(trace) {
  if (!Array.isArray(trace) || trace.length === 0) return null;
  return typeof trace[0] === 'string' ? trace[0] : null;
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function collectSongs(node, trace = [], out = []) {
  if (Array.isArray(node)) {
    node.forEach((item, idx) => collectSongs(item, [...trace, `#${idx}`], out));
    return out;
  }
  if (!node || typeof node !== 'object') return out;

  const title = normalizeText(node.title || node.name);
  const artist = normalizeText(node.artist || node.singer || node.band);
  const youtubeId = extractYoutubeId(node.youtubeId || node.youtube_id || node.youtubeVideoId || node.videoId || node.video_id);
  const youtubeUrl = normalizeText(node.youtubeUrl || node.youtube_url || node.url);
  const likelySong = Boolean(title && (youtubeId || youtubeUrl || artist || node.thumbnailUrl || node.thumbnail_url));

  if (likelySong) {
    out.push({
      title,
      artist,
      youtube_id: youtubeId || extractYoutubeId(youtubeUrl),
      youtube_url: youtubeUrl,
      thumbnail_url: normalizeText(node.thumbnailUrl || node.thumbnail_url),
      description: normalizeText(node.description),
      is_featured: normalizeBool(node.featured ?? node.isFeatured, false),
      original_genre: normalizeText(node.genre || node.genero || node.genreName),
      original_moment: normalizeText(node.moment || node.momento || node.momentName),
      tags: asArray(node.tags).map((tag) => normalizeText(tag)).filter(Boolean),
      source_block: inferSourceBlock(trace),
      source_trace: trace.join(' > '),
    });
  }

  Object.entries(node).forEach(([key, value]) => {
    if (['title', 'artist', 'youtubeId', 'youtube_id', 'youtubeVideoId'].includes(key)) return;
    if (Array.isArray(value) || (value && typeof value === 'object')) {
      collectSongs(value, [...trace, key], out);
    }
  });

  return out;
}

function dedupeSongs(songs) {
  const byYoutube = new Map();
  const byText = new Map();
  const deduped = [];
  const duplicates = [];

  songs.forEach((song) => {
    const youtubeKey = song.youtube_id ? `yt:${song.youtube_id}` : null;
    const textKey = `tx:${normalizeKey(song.title)}|${normalizeKey(song.artist)}`;
    const existing = (youtubeKey && byYoutube.get(youtubeKey)) || byText.get(textKey);

    if (existing) {
      const merged = {
        ...existing,
        artist: existing.artist || song.artist,
        youtube_id: existing.youtube_id || song.youtube_id,
        youtube_url: existing.youtube_url || song.youtube_url,
        thumbnail_url: existing.thumbnail_url || song.thumbnail_url,
        description: existing.description || song.description,
        is_featured: existing.is_featured || song.is_featured,
        original_genre: existing.original_genre || song.original_genre,
        original_moment: existing.original_moment || song.original_moment,
        tags: Array.from(new Set([...(existing.tags || []), ...(song.tags || [])])),
        source_trace: `${existing.source_trace} || ${song.source_trace}`,
      };
      if (youtubeKey) byYoutube.set(youtubeKey, merged);
      byText.set(textKey, merged);
      const idx = deduped.findIndex((item) => item === existing);
      if (idx >= 0) deduped[idx] = merged;
      duplicates.push({ kept: merged.title, droppedTrace: song.source_trace, reason: youtubeKey && byYoutube.has(youtubeKey) ? youtubeKey : textKey });
      return;
    }

    const normalizedSong = {
      ...song,
      youtube_url: song.youtube_url || (song.youtube_id ? `https://www.youtube.com/watch?v=${song.youtube_id}` : null),
      thumbnail_url: song.thumbnail_url || (song.youtube_id ? `https://img.youtube.com/vi/${song.youtube_id}/hqdefault.jpg` : null),
      source_type: 'admin',
      is_active: true,
    };

    deduped.push(normalizedSong);
    if (youtubeKey) byYoutube.set(youtubeKey, normalizedSong);
    byText.set(textKey, normalizedSong);
  });

  return { deduped, duplicates };
}

function toSqlJson(value) {
  return JSON.stringify(value).replace(/'/g, "''");
}

function buildSql(songs) {
  const payload = songs.map((song) => ({
    title: song.title,
    artist: song.artist,
    youtube_id: song.youtube_id,
    youtube_url: song.youtube_url,
    thumbnail_url: song.thumbnail_url,
    description: song.description,
    is_featured: song.is_featured,
    source_type: 'admin',
    is_active: true,
    original_genre: song.original_genre,
    original_moment: song.original_moment,
    tags: song.tags,
    source_block: song.source_block,
  }));

  const json = toSqlJson(payload);
  return `begin;

with payload as (
  select jsonb_array_elements('${json}'::jsonb) as row
), normalized as (
  select
    nullif(btrim(row->>'title'), '') as title,
    nullif(btrim(row->>'artist'), '') as artist,
    nullif(btrim(row->>'youtube_id'), '') as youtube_id,
    coalesce(nullif(btrim(row->>'youtube_url'), ''), case when nullif(btrim(row->>'youtube_id'), '') is not null then 'https://www.youtube.com/watch?v=' || nullif(btrim(row->>'youtube_id'), '') else null end) as youtube_url,
    coalesce(nullif(btrim(row->>'thumbnail_url'), ''), case when nullif(btrim(row->>'youtube_id'), '') is not null then 'https://img.youtube.com/vi/' || nullif(btrim(row->>'youtube_id'), '') || '/hqdefault.jpg' else null end) as thumbnail_url,
    nullif(btrim(row->>'description'), '') as description,
    coalesce((row->>'is_featured')::boolean, false) as is_featured,
    nullif(btrim(row->>'original_genre'), '') as original_genre,
    nullif(btrim(row->>'original_moment'), '') as original_moment,
    coalesce(row->'tags', '[]'::jsonb) as tags,
    nullif(btrim(row->>'source_block'), '') as source_block
  from payload
), resolved as (
  select n.*, g.id as genre_id, m.id as moment_id
  from normalized n
  left join public.suggestion_genres g on lower(g.name) = lower(n.original_genre)
  left join public.suggestion_moments m on lower(m.name) = lower(n.original_moment)
  where n.title is not null
), upserted as (
  insert into public.suggestion_songs (
    title, artist, genre_id, moment_id, youtube_id, youtube_url, thumbnail_url, description,
    is_featured, is_active, source_type, normalized_title, normalized_artist, updated_at
  )
  select
    r.title, r.artist, r.genre_id, r.moment_id, r.youtube_id, r.youtube_url, r.thumbnail_url, r.description,
    r.is_featured, true, 'admin', lower(r.title), lower(coalesce(r.artist, '')), now()
  from resolved r
  on conflict (youtube_id) where youtube_id is not null do update
  set title = excluded.title,
      artist = excluded.artist,
      genre_id = excluded.genre_id,
      moment_id = excluded.moment_id,
      youtube_url = excluded.youtube_url,
      thumbnail_url = excluded.thumbnail_url,
      description = excluded.description,
      is_featured = excluded.is_featured,
      is_active = true,
      source_type = 'admin',
      updated_at = now()
  returning id
), upserted_text as (
  insert into public.suggestion_songs (
    title, artist, genre_id, moment_id, youtube_id, youtube_url, thumbnail_url, description,
    is_featured, is_active, source_type, normalized_title, normalized_artist, updated_at
  )
  select
    r.title, r.artist, r.genre_id, r.moment_id, null, r.youtube_url, r.thumbnail_url, r.description,
    r.is_featured, true, 'admin', lower(r.title), lower(coalesce(r.artist, '')), now()
  from resolved r
  where r.youtube_id is null
  on conflict (normalized_title, normalized_artist) do update
  set title = excluded.title,
      artist = excluded.artist,
      genre_id = excluded.genre_id,
      moment_id = excluded.moment_id,
      youtube_url = excluded.youtube_url,
      thumbnail_url = excluded.thumbnail_url,
      description = excluded.description,
      is_featured = excluded.is_featured,
      is_active = true,
      source_type = 'admin',
      updated_at = now()
  returning id
), tag_names as (
  select distinct lower(trim(jsonb_array_elements_text(r.tags))) as tag_name
  from resolved r
  where jsonb_typeof(r.tags) = 'array'
), inserted_tags as (
  insert into public.suggestion_tags (name)
  select initcap(tag_name)
  from tag_names
  where tag_name <> ''
  on conflict (name) do nothing
  returning id
)
select
  (select count(*) from resolved) as total_rows,
  (select count(*) from upserted) as upserted_with_youtube,
  (select count(*) from upserted_text) as upserted_without_youtube,
  (select count(*) from resolved where genre_id is null and original_genre is not null) as unresolved_genre,
  (select count(*) from resolved where moment_id is null and original_moment is not null) as unresolved_moment;

commit;`;
}

function writeOptional(filePath, content) {
  if (!filePath) return;
  const resolved = path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content, 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const parsed = parseLegacyInput(readInput(args.input));
  if (!parsed) throw new Error('Não foi possível interpretar os blocos. Cole JSON válido ou blocos JS com variáveis.');

  const source = typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { catalog: parsed };
  const songs = collectSongs(source, ['root']);
  if (songs.length === 0) throw new Error('Nenhuma música encontrada nos blocos fornecidos.');

  const { deduped, duplicates } = dedupeSongs(songs);
  const sql = buildSql(deduped);

  writeOptional(args.outJson, `${JSON.stringify(deduped, null, 2)}\n`);
  writeOptional(args.outSql, `${sql}\n`);

  const summary = {
    totalExtracted: songs.length,
    totalDeduped: deduped.length,
    duplicateCount: duplicates.length,
    duplicates,
    needsManualReview: deduped
      .filter((song) => !song.youtube_id || !song.title)
      .map((song) => ({ title: song.title, artist: song.artist, source_trace: song.source_trace }))
      .slice(0, 50),
  };

  process.stdout.write(`${JSON.stringify({ consolidated: deduped, summary, sql }, null, 2)}\n`);
}

main();
