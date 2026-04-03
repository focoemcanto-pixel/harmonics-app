import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, name, role, permissions } = body;

    if (!email || !name || !role) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: email, name, role' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Create user via Admin API (server-side only)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        name,
        role,
      },
    });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    const userId = authData?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: 'ID de usuário não retornado.' },
        { status: 500 }
      );
    }

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email,
        name,
        role,
      });

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    // Save granular permissions if provided
    if (role === 'admin' && permissions && !permissions.acesso_total) {
      const { error: permError } = await supabase
        .from('user_permissions')
        .insert({
          user_id: userId,
          permissions,
        });

      if (permError) {
        console.error('Erro ao salvar permissões:', permError);
      }
    }

    return NextResponse.json({ ok: true, userId });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
