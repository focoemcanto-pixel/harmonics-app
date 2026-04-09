import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateRepertoirePdfBuffer } from '@/lib/repertorio/repertoirePdf';

export const runtime = 'nodejs';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error(
      'Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.'
    );
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveEventIdFromToken(supabase, token) {
  const { data: repertoireTokenRows, error: repertoireTokenError } = await supabase
    .from('repertoire_tokens')
    .select('id, event_id, token, status, expires_at, created_at')
    .eq('token', token)
    .order('created_at', { ascending: false })
    .limit(1);

  if (repertoireTokenError) throw repertoireTokenError;

  const repertoireToken = repertoireTokenRows?.[0] || null;
  if (repertoireToken?.event_id) {
    return repertoireToken.event_id;
  }

  const { data: precontract, error: precontractError } = await supabase
    .from('precontracts')
    .select('id, event_id, public_token')
    .eq('public_token', token)
    .maybeSingle();

  if (precontractError) throw precontractError;
  return precontract?.event_id || null;
}

export async function GET(_request, { params }) {
  try {
    const { token } = await params;
    const normalizedToken = String(token || '').trim();

    if (!normalizedToken) {
      return NextResponse.json({ ok: false, error: 'Token inválido.' }, { status: 400 });
    }

    const supabase = getAdminSupabase();
    const eventId = await resolveEventIdFromToken(supabase, normalizedToken);

    if (!eventId) {
      return NextResponse.json({ ok: false, error: 'Evento não encontrado.' }, { status: 404 });
    }

    const [eventResp, configResp, itemsResp] = await Promise.all([
      supabase.from('events').select('id, client_name, event_date, event_time, location_name').eq('id', eventId).maybeSingle(),
      supabase.from('repertoire_config').select('*').eq('event_id', eventId).maybeSingle(),
      supabase.from('repertoire_items').select('*').eq('event_id', eventId).order('item_order', { ascending: true }),
    ]);

    if (eventResp.error) throw eventResp.error;
    if (configResp.error) throw configResp.error;
    if (itemsResp.error) throw itemsResp.error;

    if (!eventResp.data) {
      return NextResponse.json({ ok: false, error: 'Evento não encontrado.' }, { status: 404 });
    }

    const pdfBuffer = await generateRepertoirePdfBuffer({
      event: eventResp.data,
      config: configResp.data || {},
      items: Array.isArray(itemsResp.data) ? itemsResp.data : [],
    });

    const fileNameBase = String(eventResp.data?.client_name || 'repertorio').replace(/[^a-zA-Z0-9-_]+/g, '-');

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="repertorio-${fileNameBase || 'evento'}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[REPERTORIO PDF] Falha ao gerar PDF:', error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Não foi possível gerar o PDF do repertório.',
      },
      { status: 500 }
    );
  }
}
