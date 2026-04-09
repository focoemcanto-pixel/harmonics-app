import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  const { data: tokenRows, error: tokenError } = await supabase
    .from('repertoire_tokens')
    .select('id, event_id, token, created_at')
    .eq('token', token)
    .order('created_at', { ascending: false })
    .limit(1);

  if (tokenError) throw tokenError;

  const repertoireToken = tokenRows?.[0] || null;
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

export async function POST(_request, { params }) {
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

    const nowIso = new Date().toISOString();
    const { data: updatedConfig, error: updateError } = await supabase
      .from('repertoire_config')
      .update({
        status: 'review_requested',
        updated_at: nowIso,
      })
      .eq('event_id', eventId)
      .select('id, event_id, status, updated_at')
      .maybeSingle();

    if (updateError) throw updateError;

    if (!updatedConfig) {
      return NextResponse.json(
        { ok: false, error: 'Configuração de repertório não encontrada.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      eventId,
      status: updatedConfig.status,
      updatedAt: updatedConfig.updated_at,
    });
  } catch (error) {
    console.error('[API REPERTORIO REVIEW] Erro ao solicitar revisão:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Não foi possível solicitar revisão.',
      },
      { status: 500 }
    );
  }
}
