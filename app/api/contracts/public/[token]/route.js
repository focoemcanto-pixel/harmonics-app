import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function normalizeToken(rawToken) {
  if (Array.isArray(rawToken)) {
    return String(rawToken[0] || '').trim();
  }
  return String(rawToken || '').trim();
}

export async function GET(request, { params }) {
  const rawToken = params?.token;

  const token = Array.isArray(rawToken)
    ? String(rawToken[0] || '').trim()
    : String(rawToken || '').trim();

  console.info('[CONTRACT_PUBLIC_ROUTE] token recebido', {
    rawToken,
    token,
  });

  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'Token inválido.' },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    console.info('[CONTRACT_PUBLIC_ROUTE] query precontracts', {
      table: 'precontracts',
      where: { public_token: token },
    });

    const { data: preData, error: preByTokenError } = await supabase
      .from('precontracts')
      .select('*')
      .eq('public_token', token)
      .limit(1);

    if (preByTokenError) throw preByTokenError;

    let precontract = preData?.[0] || null;
    let contract = null;

    if (!precontract) {
      console.info('[CONTRACT_PUBLIC_ROUTE] query contracts', {
        table: 'contracts',
        where: { public_token: token },
      });

      const { data: contractData, error: contractByTokenError } = await supabase
        .from('contracts')
        .select('*')
        .eq('public_token', token)
        .limit(1);

      if (contractByTokenError) throw contractByTokenError;

      contract = contractData?.[0] || null;

      if (contract?.precontract_id) {
        console.info('[CONTRACT_PUBLIC_ROUTE] query precontracts por precontract_id', {
          table: 'precontracts',
          where: { id: contract.precontract_id },
        });

        const { data: preByIdData, error: preByIdError } = await supabase
          .from('precontracts')
          .select('*')
          .eq('id', contract.precontract_id)
          .limit(1);

        if (preByIdError) throw preByIdError;

        precontract = preByIdData?.[0] || null;
      }
    }

    if (!precontract) {
      console.warn('[CONTRACT_PUBLIC_ROUTE] contrato inválido: nenhum precontract encontrado', {
        token,
      });

      return NextResponse.json(
        { ok: false, found: false, token },
        { status: 404 }
      );
    }

    if (!contract && precontract.id) {
      console.info('[CONTRACT_PUBLIC_ROUTE] query contracts por precontract_id', {
        table: 'contracts',
        where: { precontract_id: precontract.id },
      });

      const { data: contractByPreData, error: contractByPreIdError } = await supabase
        .from('contracts')
        .select('*')
        .eq('precontract_id', precontract.id)
        .limit(1);

      if (contractByPreIdError) throw contractByPreIdError;

      contract = contractByPreData?.[0] || null;
    }

    if (!precontract.public_token) {
      await supabase
        .from('precontracts')
        .update({ public_token: token })
        .eq('id', precontract.id);
    }

    console.info('[CONTRACT_PUBLIC_ROUTE] resultado encontrado', {
      token,
      precontractId: precontract.id,
      contractId: contract?.id || null,
      precontractPublicToken: precontract.public_token || null,
      contractPublicToken: contract?.public_token || null,
    });

    return NextResponse.json({
      ok: true,
      found: true,
      token,
      precontract,
      contract,
    });
  } catch (error) {
    console.error('[CONTRACT_PUBLIC_ROUTE] erro ao buscar contrato público', {
      token,
      message: error?.message,
    });

    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao carregar contrato público.' },
      { status: 500 }
    );
  }
}
