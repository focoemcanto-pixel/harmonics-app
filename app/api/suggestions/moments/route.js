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

async function fetchMoments(supabase) {
  const { data, error } = await supabase
    .from('suggestion_moments')
    .select('id, name, slug, is_active, sort_order, created_at, updated_at')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function GET() {
  try {
    console.info('[sugestoes] load start moments');
    const supabase = getSupabaseAdmin();
    const moments = await fetchMoments(supabase);

    console.info('[sugestoes] data loaded moments', { count: moments.length });

    return NextResponse.json({ ok: true, moments });
  } catch (error) {
    console.error('[sugestoes] error moments', error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          'Momentos não encontrados na tabela suggestion_moments',
      },
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
      .from('suggestion_moments')
      .insert({
        name,
        slug,
        is_active,
        sort_order,
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, moment: data });
  } catch (error) {
    console.error('Erro ao criar suggestion_moment:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro ao criar momento' },
      { status: 500 }
    );
  }
}
