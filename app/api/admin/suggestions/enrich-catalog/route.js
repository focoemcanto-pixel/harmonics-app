import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { backfillSuggestionSongsMetadata } from '@/lib/sugestoes/backfill-suggestion-songs-metadata';

export async function POST() {
  try {
    const supabase = getSupabaseAdmin();
    const result = await backfillSuggestionSongsMetadata(supabase, { logger: console });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    console.error('[sugestoes] enrich catalog error', error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Falha ao enriquecer catálogo suggestion_songs.',
      },
      { status: 500 }
    );
  }
}
