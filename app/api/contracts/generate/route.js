import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildContractTemplateData } from '../../../../lib/contracts/buildContractTemplateData';
import { generateInternalContract } from '../../../../lib/contracts/internalContractGenerator';

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ ok: false, message: 'Supabase não configurado.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const body = await request.json();
    const contractId = body?.contractId || null;
    const precontractId = body?.precontractId || null;

    const { data: precontract } = await supabase
      .from('precontracts')
      .select('*')
      .eq('id', precontractId)
      .single();

    const templateData = buildContractTemplateData({ precontract });

    const isInternal = precontract?.custom_contract_enabled || precontract?.contract_mode === 'internal';

    if (isInternal) {
      const internal = generateInternalContract({ precontract }, templateData);
      return NextResponse.json({ ok: true, mode: 'internal', html: internal.html });
    }

    return NextResponse.json({ ok: true, mode: 'docs', message: 'fluxo original mantido' });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e.message }, { status: 500 });
  }
}
