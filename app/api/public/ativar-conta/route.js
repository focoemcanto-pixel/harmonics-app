import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    if (!email) return NextResponse.json({ ok: false, message: 'E-mail obrigatório.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login?reset=done`;
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return NextResponse.json({ ok: true, message: 'Se o e-mail existir, enviamos o link de ativação.' });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error?.message || 'Erro ao enviar ativação.' }, { status: 500 });
  }
}
