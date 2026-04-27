import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdminServer } from '@/lib/api/require-admin-server';

export async function GET(request) {
  const adminGuard = await requireAdminServer(request);
  if (!adminGuard.ok) {
    return adminGuard.response;
  }

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
