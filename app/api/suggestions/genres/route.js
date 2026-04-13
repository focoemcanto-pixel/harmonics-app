import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function fetchGenres(supabase) {
  const { data, error } = await supabase
    .from('suggestion_genres')
    .select('id, name, slug, is_active, sort_order, created_at, updated_at')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const genres = await fetchGenres(supabase);

    console.log('[sugestoes-debug] GET /api/suggestions/genres', {
      count: genres.length,
    });

    return NextResponse.json({ ok: true, genres });
  } catch (error) {
    console.error('Erro ao listar suggestion_genres:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro ao listar gêneros' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const name = String(body?.name || '').trim();
    const slug = String(body?.slug || '').trim() || slugify(name);
    const is_active =
      typeof body?.is_active === 'boolean' ? body.is_active : true;
    const sort_order = Number.isFinite(Number(body?.sort_order))
      ? Number(body.sort_order)
      : 0;

    if (!name) {
      return NextResponse.json(
        { error: 'name é obrigatório' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('suggestion_genres')
      .insert({
        name,
        slug,
        is_active,
        sort_order,
      })
      .select('*')
      .single();

    if (error) throw error;

    console.log('[sugestoes-debug] POST /api/suggestions/genres', {
      id: data?.id,
      name: data?.name,
    });

    return NextResponse.json({ ok: true, genre: data });
  } catch (error) {
    console.error('Erro ao criar suggestion_genre:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro ao criar gênero' },
      { status: 500 }
    );
  }
}
