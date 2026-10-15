import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Catálogo público de planos — mesma fonte que o backend usa para limites.
export async function GET() {
  const { data, error } = await getSupabaseAdmin()
    .from('workspace_plans')
    .select('id, slug, name, description, monthly_price, max_members, max_events_per_month, max_whatsapp_messages, can_use_automation, can_use_contracts, can_use_whatsapp, can_use_white_label, sort_order')
    .eq('is_public', true)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: 'Não foi possível carregar os planos.' }, { status: 500 });
  return NextResponse.json({ ok: true, plans: data || [] });
}
