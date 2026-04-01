import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { sendWhatsAppMessage } from '../../../../lib/whatsapp/send-whatsapp-message';
import { buildContractSignedMessage } from '../../../../lib/whatsapp/build-contract-signed-message';
import { logAutomationDispatch } from '../../../../lib/automation/log-dispatch';
import { getDefaultWorkspace } from '../../../../lib/automation/get-workspace';

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

export async function POST(request) {
  const supabaseAdmin = getSupabaseAdmin();
  const workspaceId = await getDefaultWorkspace();

  try {
    const body = await request.json();
    const precontractId = body?.precontractId;

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

    const baseUrl = process.env.APP_BASE_URL;
    if (!baseUrl) {
      throw new Error('APP_BASE_URL não configurada');
    }

    if (!precontract.public_token) {
      return NextResponse.json(
        { error: 'Pré-contrato sem public_token' },
        { status: 400 }
      );
    }

    const clientPanelUrl = `${baseUrl}/cliente/${precontract.public_token}`;

    const message = buildContractSignedMessage({
      clientName: precontract.client_name,
      clientPanelUrl,
    });

    await sendWhatsAppMessage({
      to: phone,
      message,
    });

    const { error: updateError } = await supabaseAdmin
      .from('contracts')
      .update({
        whatsapp_signed_sent: true,
        whatsapp_signed_sent_at: new Date().toISOString(),
      })
      .eq('id', contract.id);

    if (updateError) {
      throw updateError;
    }

    await logAutomationDispatch({
      workspaceId,
      ruleId: null,
      templateId: null,
      channelId: null,
      entityId: contract.id,
      entityType: 'contract',
      recipientType: 'client',
      recipient: phone,
      renderedMessage: message,
      metadata: {
        precontractId: precontractId,
        clientName: precontract.client_name,
        publicToken: precontract.public_token,
      },
      providerResponse: null,
      status: 'sent',
      errorMessage: null,
      source: 'legacy_contract_signed',
    });

    return NextResponse.json({
      ok: true,
      contractId: contract.id,
      precontractId: precontract.id,
      phone,
    });
  } catch (error) {
    console.error('Erro ao enviar WhatsApp pós-assinatura:', error);

    await logAutomationDispatch({
      workspaceId,
      ruleId: null,
      templateId: null,
      channelId: null,
      entityId: precontractId,
      entityType: 'contract',
      recipientType: 'client',
      recipient: null,
      renderedMessage: null,
      metadata: { error: error?.message },
      providerResponse: null,
      status: 'failed',
      errorMessage: error?.message || 'Erro interno',
      source: 'legacy_contract_signed',
    });

    return NextResponse.json(
      { error: error?.message || 'Erro interno ao enviar mensagem pós-assinatura' },
      { status: 500 }
    );
  }
}
