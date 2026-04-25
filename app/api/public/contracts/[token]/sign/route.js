import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function asString(value) {
  return String(value || '').trim();
}

function extractToken(params) {
  if (Array.isArray(params?.token)) return asString(params.token[0]);
  return asString(params?.token);
}

/**
 * Fase 2 (pre-RLS): endpoint criado propositalmente sem mover a lógica completa
 * da assinatura client-side nesta PR para evitar regressão no fluxo público atual.
 */
export async function POST(_request, context) {
  const params = await context?.params;
  const token = extractToken(params);

  if (!token) {
    return NextResponse.json({ ok: false, message: 'Token inválido.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: precontract, error } = await supabase
      .from('precontracts')
      .select('id, public_token, status')
      .eq('public_token', token)
      .maybeSingle();

    if (error) throw error;

    if (!precontract?.id) {
      return NextResponse.json({ ok: false, message: 'Contrato não encontrado.' }, { status: 404 });
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          'Endpoint de assinatura server-side preparado, mas ainda não ativado nesta fase para evitar regressão do fluxo público.',
        phase: 'pre-rls',
        token,
        precontractId: precontract.id,
        requiredNextStep:
          'Migrar com segurança a lógica atual de assinatura da página pública para o servidor em uma PR dedicada.',
      },
      { status: 501 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err?.message || 'Erro ao validar token de assinatura.',
      },
      { status: 500 }
    );
  }
}
