import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { data: logs, error } = await supabaseAdmin
      .from('automation_logs')
      .select('id, status, recipient_number, rendered_message, source, error_message, created_at, sent_at, recipient_type')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      logs: logs || [],
    });
  } catch (error) {
    console.error('Erro ao carregar logs de automação:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno ao carregar logs' },
      { status: 500 }
    );
  }
}
