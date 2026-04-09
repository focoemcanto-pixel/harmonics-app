import { NextResponse } from 'next/server';
import { mapYoutubeSearchItems } from '../../../../lib/youtube/mapYoutubeSearchItems';
import {
  getYoutubeSearchCache,
  normalizeYoutubeSearchQuery,
  setYoutubeSearchCache,
} from '../../../../lib/youtube/searchCache';

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 5;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get('q') || '';
  const query = rawQuery.trim();
  const normalizedQuery = normalizeYoutubeSearchQuery(rawQuery);

  console.debug(`[youtube-search] Query normalizada: "${normalizedQuery}"`);

  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json(
      {
        ok: false,
        error: `Digite pelo menos ${MIN_QUERY_LENGTH} caracteres para buscar.`,
        items: [],
      },
      { status: 400 }
    );
  }

  const cachedItems = getYoutubeSearchCache(rawQuery);
  if (cachedItems) {
    console.debug(`[youtube-search] Cache hit para: "${normalizedQuery}"`);

    return NextResponse.json({
      ok: true,
      items: cachedItems,
    });
  }

  console.debug(`[youtube-search] Cache miss para: "${normalizedQuery}"`);

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('[youtube-search] YOUTUBE_API_KEY não configurada no servidor.');
    return NextResponse.json(
      {
        ok: false,
        error: 'Busca temporariamente indisponível. Tente novamente em instantes.',
        items: [],
      },
      { status: 500 }
    );
  }

  const endpoint = new URL('https://www.googleapis.com/youtube/v3/search');
  endpoint.searchParams.set('part', 'snippet');
  endpoint.searchParams.set('type', 'video');
  endpoint.searchParams.set('maxResults', String(MAX_RESULTS));
  endpoint.searchParams.set('q', query);
  endpoint.searchParams.set('key', apiKey);

  try {
    console.debug(`[youtube-search] Buscando no YouTube: "${query}"`);

    const response = await fetch(endpoint.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[youtube-search] Erro da YouTube API:', {
        status: response.status,
        body: errorBody,
      });

      return NextResponse.json(
        {
          ok: false,
          error: 'Não foi possível buscar referências no YouTube agora.',
          items: [],
        },
        { status: 502 }
      );
    }

    const data = await response.json();
    const mappedItems = mapYoutubeSearchItems(data?.items);

    setYoutubeSearchCache(rawQuery, mappedItems);

    return NextResponse.json({
      ok: true,
      items: mappedItems,
    });
  } catch (error) {
    console.error('[youtube-search] Falha inesperada ao buscar no YouTube:', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'Erro inesperado ao buscar referências. Tente novamente.',
        items: [],
      },
      { status: 500 }
    );
  }
}
