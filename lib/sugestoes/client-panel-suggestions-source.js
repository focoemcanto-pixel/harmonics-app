import { readFile } from 'node:fs/promises';
import path from 'node:path';

const CLIENTE_HOME_PATH = path.join(process.cwd(), 'components/cliente/ClienteHome.js');
const START_TOKEN = 'const [songs, setSongs] = useState(';

let cache = null;

function extractArrayLiteral(sourceCode) {
  const start = sourceCode.indexOf(START_TOKEN);
  if (start < 0) {
    throw new Error('Fonte de sugestões do cliente não encontrada em ClienteHome.js');
  }

  const openParen = sourceCode.indexOf('(', start + START_TOKEN.length - 1);
  const openBracket = sourceCode.indexOf('[', openParen);
  if (openBracket < 0) {
    throw new Error('Array de sugestões do cliente não encontrado em ClienteHome.js');
  }

  let i = openBracket;
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;

  while (i < sourceCode.length) {
    const ch = sourceCode[i];

    if (escaped) {
      escaped = false;
      i += 1;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      i += 1;
      continue;
    }

    if (!inDouble && !inTemplate && ch === "'") {
      inSingle = !inSingle;
      i += 1;
      continue;
    }

    if (!inSingle && !inTemplate && ch === '"') {
      inDouble = !inDouble;
      i += 1;
      continue;
    }

    if (!inSingle && !inDouble && ch === '`') {
      inTemplate = !inTemplate;
      i += 1;
      continue;
    }

    if (inSingle || inDouble || inTemplate) {
      i += 1;
      continue;
    }

    if (ch === '[') depth += 1;
    if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        return sourceCode.slice(openBracket, i + 1);
      }
    }

    i += 1;
  }

  throw new Error('Não foi possível determinar o fim do array de sugestões do cliente');
}

function mapSong(rawSong = {}, index = 0) {
  const youtubeId = String(rawSong?.youtubeId || '').trim();
  return {
    id: String(rawSong?.id || index + 1),
    title: String(rawSong?.title || '').trim(),
    artist: String(rawSong?.artist || '').trim(),
    genre: String(rawSong?.genre || '').trim(),
    moment: String(rawSong?.moment || '').trim(),
    youtube_id: youtubeId || null,
    youtube_url: youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : null,
    thumbnail_url: String(rawSong?.thumbnailUrl || '').trim() || null,
  };
}

export async function loadClientPanelSuggestions() {
  if (cache) return cache;

  const sourceCode = await readFile(CLIENTE_HOME_PATH, 'utf8');
  const arrayLiteral = extractArrayLiteral(sourceCode);
  const parsed = Function(`"use strict"; return (${arrayLiteral});`)();

  if (!Array.isArray(parsed)) {
    throw new Error('Fonte de sugestões do cliente inválida: esperado array');
  }

  cache = parsed.map((item, index) => mapSong(item, index)).filter((item) => item.title);
  return cache;
}
