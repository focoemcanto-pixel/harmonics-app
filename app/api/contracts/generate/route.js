import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRequiredEnv } from '@/lib/config/validate-env';
import { generateContractDocument } from '@/lib/contracts/generate-contract-document';
import { logError, logInfo, logWarn, safeError } from '@/lib/observability/server-log';
import { sendAdminWhatsAppAlert } from '@/lib/whatsapp/send-admin-alert';
import { requireWorkspaceAccess } from '@/lib/api/require-workspace-access';

export const dynamic = 'force-dynamic';

function validateSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [];
  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length > 0) return { valid: false, error: `Variáveis de ambiente faltando: ${missing.join(', ')}` };
  return { valid: true, supabaseUrl, supabaseServiceRoleKey };
}

function getReadableErrorMessage(error) {
  if (!error) return 'Erro interno ao gerar contrato.';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || 'Erro interno ao gerar contrato.';
  if (typeof error === 'object') {
    try { return JSON.stringify(error); } catch { return 'Erro interno ao gerar contrato.'; }
  }
  return String(error);
}

async function notifyAdminContractGenerationIssue({ context, reason, error }) {
  try {
    const clientName = context?.contact?.name || context?.precontract?.client_name || context?.event?.client_name || 'Cliente não identificado';
    const eventDate = context?.event?.event_date || context?.precontract?.event_date || 'Data não identificada';
    const message = [
      '🚨 Falha crítica na geração de contrato',
      `Motivo: ${reason}`,
      `Cliente: ${clientName}`,
      `Data do evento: ${eventDate}`,
      `Precontract ID: ${context?.precontract?.id || 'não informado'}`,
      `Contract ID: ${context?.contract?.id || 'não encontrado'}`,
      error?.message ? `Erro técnico: ${error.message}` : null,
    ].filter(Boolean).join('\n');
    await sendAdminWhatsAppAlert(message);
  } catch (whatsappError) {
    logWarn('CONTRACT_GENERATE', 'ADMIN_WHATSAPP_ALERT_FAILED', { error: whatsappError?.message || String(whatsappError) });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'Use POST para gerar preview ou contrato final.' });
}

export async function POST(request) {
  try {
    requireRequiredEnv('contracts/generate');
    logInfo('CONTRACT_GENERATE', 'START');

    const supabaseEnv = validateSupabaseEnv();
    if (!supabaseEnv.valid) return NextResponse.json({ ok: false, message: supabaseEnv.error }, { status: 500 });

    const supabase = createClient(supabaseEnv.supabaseUrl, supabaseEnv.supabaseServiceRoleKey);

    const auth = await requireWorkspaceAccess({
      supabase,
      request,
      moduleKey: 'contratos',
      actionKey: 'write',
      logPrefix: '[CONTRACT_GENERATE][POST]',
      allowedRoles: ['owner', 'admin', 'financeiro'],
    });

    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.error, error: auth.error }, { status: auth.status || 401 });
    }

    const workspaceId = auth.workspaceId;
    logInfo('CONTRACT_GENERATE', 'WORKSPACE_CONTEXT', {
      workspaceId,
      source: auth.source || 'requireWorkspaceAccess',
      userId: auth.userId,
      role: auth.role,
    });

    let body = {};
    try { body = await request.json(); } catch {
      return NextResponse.json({ ok: false, message: 'Payload inválido. Envie JSON válido no corpo da requisição.' }, { status: 400 });
    }

    const result = await generateContractDocument({
      supabase,
      contractId: body?.contractId || null,
      precontractId: body?.precontractId || null,
      previewOnly: !!body?.previewOnly,
    });

    const context = result?.context;

    logInfo('CONTRACT_GENERATE', 'CONTEXT_RESOLVED', {
      contractId: context?.contract?.id || body?.contractId || null,
      precontractId: context?.precontract?.id || body?.precontractId || null,
      eventId: context?.event?.id || null,
      workspaceId,
    });

    const contextWorkspaceId = context?.contract?.workspace_id || context?.precontract?.workspace_id || context?.event?.workspace_id || null;
    if (!contextWorkspaceId || String(contextWorkspaceId) !== String(workspaceId)) {
      logWarn('CONTRACT_GENERATE', 'WORKSPACE_MISMATCH_BLOCKED', {
        contextWorkspaceId,
        authWorkspaceId: workspaceId,
        userId: auth.userId,
      });
      return NextResponse.json({ ok: false, message: 'Contrato não pertence ao workspace atual.' }, { status: 403 });
    }

    if (!result?.ok) {
      if (result?.error === 'CONTRACT_NOT_FOUND_FOR_PRECONTRACT') {
        const structuralError = new Error(result?.message || 'Contract não encontrado');
        logError('CONTRACT_GENERATE', 'MISSING_CONTRACT_FOR_PRECONTRACT', structuralError, {
          precontractId: context?.precontract?.id || body?.precontractId || null,
          eventId: context?.event?.id || null,
          contactId: context?.contact?.id || null,
        });
        await notifyAdminContractGenerationIssue({
          context,
          reason: 'Pré-contrato encontrado, mas nenhum registro correspondente foi localizado em contracts.',
          error: structuralError,
        });
      }

      return NextResponse.json(
        { ok: false, error: result?.error || result?.message, message: result?.message, errorType: result?.errorType || 'ContractGenerationError' },
        { status: result?.status || 500 }
      );
    }

    return NextResponse.json({ ...result, context: undefined });
  } catch (error) {
    logError('CONTRACT_GENERATE', 'ERROR', error, { ...safeError(error) });
    return NextResponse.json({ ok: false, error: getReadableErrorMessage(error), errorType: error?.name || 'UnknownError' }, { status: 500 });
  }
}
