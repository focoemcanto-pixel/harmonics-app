import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { loadPublicPlans } from '@/lib/billing/public-plans';

export const dynamic = 'force-dynamic';

// Catálogo público de planos — mesma fonte que o backend usa para limites.
export async function GET() {
  const { plans, error } = await loadPublicPlans(getSupabaseAdmin());

  if (error) return NextResponse.json({ ok: false, error: 'Não foi possível carregar os planos.' }, { status: 500 });
  return NextResponse.json({ ok: true, plans });
}
