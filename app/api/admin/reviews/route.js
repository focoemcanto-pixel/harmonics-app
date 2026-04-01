import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('client_reviews')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      reviews: data || [],
    });
  } catch (error) {
    console.error('Erro ao listar client_reviews:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro ao listar avaliações' },
      { status: 500 }
    );
  }
}
