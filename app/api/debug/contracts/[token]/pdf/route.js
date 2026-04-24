export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request, context) {
  const resolvedParams = await context?.params;
  const token = String(resolvedParams?.token || '').trim();

  const { searchParams } = new URL(request.url);
  const debugKey = searchParams.get('debugKey');

  if (debugKey !== process.env.DEBUG_INTERNAL_KEY) {
    return Response.json({ ok: false, code: 'UNAUTHORIZED_DEBUG' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // 1. Buscar pré-contrato
  const { data: precontract, error } = await supabase
    .from('precontracts')
    .select('*')
    .eq('public_token', token)
    .single();

  if (error || !precontract) {
    return Response.json({
      ok: false,
      step: 'fetch_precontract',
      error,
      found: false,
    });
  }

  // 2. Simular chamada do PDF (SEM Render ainda)
  return Response.json({
    ok: true,
    step: 'precontract_loaded',
    token,
    precontractId: precontract.id,
    client: precontract.client_name,
    value: precontract.value,
    eventDate: precontract.event_date,
  });
}
