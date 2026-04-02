import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { executeAutomationEvent } from '../../../../lib/automation/execute-automation-event';

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

/**
 * Rota legada de envio de mensagem pós-assinatura de contrato por WhatsApp.
 *
 * Migrada para usar o motor novo via executeAutomationEvent (Opção A — wrapper).
 * A única fonte real de envio e logging é o motor de automação.
 * Esta rota mantém suas responsabilidades únicas:
 *   - validação do pré-contrato e contrato
 *   - verificação de status de assinatura
 *   - proteção de duplicidade via flag whatsapp_signed_sent (legado)
 *   - atualização do flag após envio bem-sucedido
 */
export async function POST(request) {
  const supabaseAdmin = getSupabaseAdmin();
  let precontractId;
  try {
    const body = await request.json();
    precontractId = body?.precontractId;

    if (!precontractId) {
      return NextResponse.json(
        { error: 'precontractId é obrigatório' },
        { status: 400 }
      );
    }

    const { data: precontract, error: precontractError } = await supabaseAdmin
      .from('precontracts')
      .select(`
        id,
        public_token,
        client_name,
        client_phone,
        status
      `)
      .eq('id', precontractId)
      .single();

    if (precontractError || !precontract) {
      return NextResponse.json(
        { error: 'Pré-contrato não encontrado' },
        { status: 404 }
      );
    }

    const { data: contract, error: contractError } = await supabaseAdmin
      .from('contracts')
      .select(`
        id,
        status,
        whatsapp_signed_sent,
        whatsapp_signed_sent_at
      `)
      .eq('precontract_id', precontractId)
      .maybeSingle();

    if (contractError) {
      throw contractError;
    }

    if (!contract) {
      return NextResponse.json(
        { error: 'Contrato ainda não encontrado para este pré-contrato' },
        { status: 404 }
      );
    }

    if (String(contract.status || '').toLowerCase() !== 'signed') {
      return NextResponse.json(
        { error: 'Contrato ainda não está assinado' },
        { status: 400 }
      );
    }

    // Proteção de duplicidade legada — flag no banco do contrato
    if (contract.whatsapp_signed_sent) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'Mensagem pós-assinatura já enviada anteriormente',
      });
    }

    const phone = cleanPhone(precontract.client_phone);
    if (!phone) {
      return NextResponse.json(
        { error: 'Cliente sem telefone no pré-contrato' },
        { status: 400 }
      );
    }

    if (!precontract.public_token) {
      return NextResponse.json(
        { error: 'Pré-contrato sem public_token' },
        { status: 400 }
      );
    }

    // Delegar envio ao motor novo — única fonte real de execução e logging
    // Usa precontractId como entityId (resolve-recipient tenta buscar como precontract primeiro)
    const result = await executeAutomationEvent({
      eventType: 'contract_signed_client',
      entityId: precontractId,
    });

    // If the engine didn't find active rules, return a warning (sending was skipped — not an error)
    if (result.sent === 0 && result.skipped === 0 && result.failed === 0) {
      return NextResponse.json({
        ok: true,
        contractId: contract.id,
        precontractId: precontract.id,
        warning: result.message || 'Nenhuma regra ativa encontrada para contract_signed_client',
      });
    }

    // Se houve falhas, retornar erro
    if (result.failed > 0 && result.sent === 0) {
      const firstError = result.executions.find((e) => e.status === 'failed')?.error;
      return NextResponse.json(
        { error: firstError || 'Erro ao enviar mensagem pelo motor de automação' },
        { status: 500 }
      );
    }

    // Atualizar flag de duplicidade legada no contrato
    const { error: updateError } = await supabaseAdmin
      .from('contracts')
      .update({
        whatsapp_signed_sent: true,
        whatsapp_signed_sent_at: new Date().toISOString(),
      })
      .eq('id', contract.id);

    if (updateError) {
      console.error('[send-contract-signed] Erro ao atualizar flag de rastreamento:', updateError);
    }

    return NextResponse.json({
      ok: true,
      contractId: contract.id,
      precontractId: precontract.id,
      phone,
      executions: result.executions,
      sent: result.sent,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error('[send-contract-signed] Erro ao enviar WhatsApp pós-assinatura:', error);

    return NextResponse.json(
      { error: error?.message || 'Erro interno ao enviar mensagem pós-assinatura' },
      { status: 500 }
    );
  }
}
