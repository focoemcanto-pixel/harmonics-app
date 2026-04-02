import { NextResponse } from 'next/server';
import { getDefaultWorkspace } from '@/lib/automation/get-workspace';
import { getActiveRules } from '@/lib/automation/get-active-rules';
import { getChannel } from '@/lib/automation/get-channel';
import { resolveRecipient } from '@/lib/automation/resolve-recipient';
import { buildAutomationContext } from '@/lib/automation/build-automation-context';
import { checkAutomationDuplicate } from '@/lib/automation/check-automation-duplicate';
import { logAutomationDispatch } from '@/lib/automation/log-dispatch';
import { sendWhatsAppMessage } from '@/lib/whatsapp/send-whatsapp-message';
import { buildInviteMessage } from '@/lib/whatsapp/build-invite-message';
import { buildContractSignedMessage } from '@/lib/whatsapp/build-contract-signed-message';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const SUPPORTED_EVENT_TYPES = ['invite_member', 'contract_signed_client'];

/**
 * Renderiza mensagem a partir de template dinâmico ou fallback para builders legados
 */
function renderTemplate(templateBody, context) {
  let rendered = templateBody;
  for (const [key, value] of Object.entries(context)) {
    rendered = rendered.replaceAll(key, value ?? '');
  }
  return rendered;
}

/**
 * Busca template por ID se existir
 */
async function fetchTemplateById(templateId) {
  if (!templateId) return null;
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('message_templates')
      .select('id, name, key, body, is_active')
      .eq('id', templateId)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Gera mensagem final: usa template do banco se disponível, senão fallback para builders legados
 */
async function resolveMessage(eventType, rule, recipientData, context) {
  // Tentar usar template do banco
  if (rule.template_id) {
    const template = await fetchTemplateById(rule.template_id);
    if (template?.body) {
      return {
        message: renderTemplate(template.body, context),
        templateId: template.id,
      };
    }
  }

  // Fallback para builders legados
  if (eventType === 'invite_member') {
    const { invite } = recipientData.contextData || {};
    const inviteLink = context['{link_painel_cliente}'] || context['{link_convite}'] || '';
    const message = buildInviteMessage({
      contactName: invite?.contact?.name,
      event: invite?.event,
      inviteLink,
      role: invite?.suggested_role_name,
    });
    return { message, templateId: null };
  }

  if (eventType === 'contract_signed_client') {
    const { precontract } = recipientData.contextData || {};
    const clientPanelUrl = context['{link_painel_cliente}'] || '';
    const message = buildContractSignedMessage({
      clientName: precontract?.client_name,
      clientPanelUrl,
    });
    return { message, templateId: null };
  }

  throw new Error('Não foi possível gerar mensagem para o evento');
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { eventType, entityId, workspaceId: inputWorkspaceId } = body;

    if (!eventType || !entityId) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: eventType, entityId' },
        { status: 400 }
      );
    }

    if (!SUPPORTED_EVENT_TYPES.includes(eventType)) {
      return NextResponse.json(
        { error: 'Event type not supported yet', supported: SUPPORTED_EVENT_TYPES },
        { status: 400 }
      );
    }

    // Resolver workspaceId
    const workspaceId = inputWorkspaceId || (await getDefaultWorkspace());
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace não encontrado' },
        { status: 500 }
      );
    }

    // Buscar regras ativas para este evento
    const rules = await getActiveRules(workspaceId, eventType);

    if (rules.length === 0) {
      return NextResponse.json({
        ok: true,
        executions: [],
        skipped: 0,
        failed: 0,
        sent: 0,
        message: 'Nenhuma regra ativa encontrada para este evento',
      });
    }

    // Resolver destinatário (uma vez para todas as regras)
    let recipientData;
    try {
      recipientData = await resolveRecipient(eventType, entityId, rules[0]);
    } catch (err) {
      return NextResponse.json(
        { error: `Erro ao resolver destinatário: ${err.message}` },
        { status: 400 }
      );
    }

    // Montar contexto de variáveis
    const context = await buildAutomationContext(eventType, entityId, recipientData);

    const executions = [];
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const rule of rules) {
      const executionResult = {
        ruleId: rule.id,
        ruleName: rule.name,
        status: null,
        recipient: recipientData.recipientNumber,
        error: null,
      };

      try {
        // Verificar duplicidade
        const isDuplicate = await checkAutomationDuplicate(
          workspaceId,
          rule.id,
          entityId,
          recipientData.recipientNumber
        );

        if (isDuplicate) {
          executionResult.status = 'skipped';
          executionResult.error = 'Mensagem já enviada anteriormente (duplicidade)';
          skippedCount++;
          executions.push(executionResult);
          continue;
        }

        // Resolver canal (opcional — fallback para env vars ocorre internamente em sendWhatsAppMessage)
        let channelId = rule.channel_id || null;
        if (channelId) {
          const channel = await getChannel(workspaceId, channelId);
          if (!channel) {
            // Canal configurado não encontrado/inativo — usará fallback das env vars
            channelId = null;
          }
        }

        // Resolver mensagem
        const { message, templateId } = await resolveMessage(
          eventType,
          rule,
          recipientData,
          context
        );

        // Enviar mensagem
        let providerResponse = null;
        try {
          providerResponse = await sendWhatsAppMessage({
            to: recipientData.recipientNumber,
            message,
          });
        } catch (sendErr) {
          throw sendErr;
        }

        // Registrar log de sucesso
        await logAutomationDispatch({
          workspaceId,
          ruleId: rule.id,
          templateId: templateId || rule.template_id || null,
          channelId: channelId || null,
          entityId,
          entityType: eventType === 'invite_member' ? 'invite' : 'contract',
          recipientType: recipientData.recipientType,
          recipient: recipientData.recipientNumber,
          renderedMessage: message,
          metadata: {
            eventType,
            entityId,
            recipientName: recipientData.recipientName,
            contextData: recipientData.contextData,
          },
          providerResponse,
          status: 'sent',
          errorMessage: null,
          source: 'automation_center',
        });

        executionResult.status = 'sent';
        sentCount++;
      } catch (err) {
        console.error(`[automation/send] Erro na regra ${rule.id}:`, err);

        // Registrar log de falha
        await logAutomationDispatch({
          workspaceId,
          ruleId: rule.id,
          templateId: rule.template_id || null,
          channelId: rule.channel_id || null,
          entityId,
          entityType: eventType === 'invite_member' ? 'invite' : 'contract',
          recipientType: recipientData?.recipientType || null,
          recipient: recipientData?.recipientNumber || null,
          renderedMessage: null,
          metadata: { eventType, entityId, error: err?.message },
          providerResponse: null,
          status: 'failed',
          errorMessage: err?.message || 'Erro desconhecido',
          source: 'automation_center',
        });

        executionResult.status = 'failed';
        executionResult.error = err?.message || 'Erro desconhecido';
        failedCount++;
      }

      executions.push(executionResult);
    }

    return NextResponse.json({
      ok: true,
      executions,
      skipped: skippedCount,
      failed: failedCount,
      sent: sentCount,
    });
  } catch (error) {
    console.error('[POST /api/automation/send] Erro:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
