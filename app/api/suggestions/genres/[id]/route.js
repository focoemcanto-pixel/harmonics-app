import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin';

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function PATCH(request, { params }) {
  try {
    const supabase = getSupabaseAdmin();
    const id = String(params?.id || '').trim();

    if (!id) {
      return NextResponse.json(
        { error: 'id é obrigatório' },
        { status: 400 }
      );
    }

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
      .update({
        name,
        slug,
        is_active,
        sort_order,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, genre: data });
  } catch (error) {
    console.error('Erro ao atualizar suggestion_genre:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro ao atualizar gênero' },
      { status: 500 }
    );
  }
}
