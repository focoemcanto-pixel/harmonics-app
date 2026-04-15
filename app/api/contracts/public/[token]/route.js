import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function normalizeToken(rawToken) {
  if (Array.isArray(rawToken)) {
    return String(rawToken[0] || '').trim();
  }
  return String(rawToken || '').trim();
}

export async function GET(_request, context) {
  const rawToken = context?.params?.token;
  const token = normalizeToken(rawToken);

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

    const { data: preByToken, error: preByTokenError } = await supabase
      .from('precontracts')
      .select('*')
      .eq('public_token', token)
      .maybeSingle();

    if (preByTokenError) throw preByTokenError;

    let precontract = preByToken || null;
    let contract = null;

    if (!precontract) {
      console.info('[CONTRACT_PUBLIC_ROUTE] query contracts', {
        table: 'contracts',
        where: { public_token: token },
      });

      const { data: contractByToken, error: contractByTokenError } = await supabase
        .from('contracts')
        .select('*')
        .eq('public_token', token)
        .maybeSingle();

      if (contractByTokenError) throw contractByTokenError;
      contract = contractByToken || null;

      if (contractByToken?.precontract_id) {
        console.info('[CONTRACT_PUBLIC_ROUTE] query precontracts por precontract_id', {
          table: 'precontracts',
          where: { id: contractByToken.precontract_id },
        });

        const { data: preById, error: preByIdError } = await supabase
          .from('precontracts')
          .select('*')
          .eq('id', contractByToken.precontract_id)
          .maybeSingle();

        if (preByIdError) throw preByIdError;
        precontract = preById || null;
      }
    }

    if (!precontract) {
      console.warn('[CONTRACT_PUBLIC_ROUTE] contrato inválido: nenhum precontract encontrado', {
        token,
      });
      return NextResponse.json({ ok: false, found: false, token }, { status: 404 });
    }

    if (!contract && precontract.id) {
      console.info('[CONTRACT_PUBLIC_ROUTE] query contracts por precontract_id', {
        table: 'contracts',
        where: { precontract_id: precontract.id },
      });

      const { data: contractByPreId, error: contractByPreIdError } = await supabase
        .from('contracts')
        .select('*')
        .eq('precontract_id', precontract.id)
        .maybeSingle();

      if (contractByPreIdError) throw contractByPreIdError;
      contract = contractByPreId || null;
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
