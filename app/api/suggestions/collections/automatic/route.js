import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getAutomaticSuggestionCollections } from '@/lib/sugestoes/automatic-collections';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const collections = await getAutomaticSuggestionCollections(supabase);

    return NextResponse.json({
      ok: true,
      collections,
    });
  } catch (error) {
    console.error('[sugestoes] error automatic collections', {
      message: error?.message || 'unknown error',
      details: error?.details || null,
      hint: error?.hint || null,
      code: error?.code || null,
    });

    return NextResponse.json(
      {
        ok: false,
        collections: [],
        error: 'Não foi possível carregar coleções automáticas agora.',
      },
      { status: 200 }
    );
  }
}
