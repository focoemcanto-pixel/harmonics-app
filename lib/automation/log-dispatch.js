import { getSupabaseAdmin } from '../supabase-admin';
import { resolveWorkspaceSettings } from './get-workspace';

function normalizeDispatchStatus(inputStatus) {
  const normalized = String(inputStatus || '').toLowerCase();
  if (normalized === 'success' || normalized === 'sent') return 'sent';
  if (normalized === 'error' || normalized === 'failed' || normalized === 'failure') return 'failed';
  if (normalized === 'skipped' || normalized === 'ignore' || normalized === 'ignored') return 'skipped';
  return 'failed';
}

function normalizeRecipient(recipient) {
  if (!recipient) return null;
  const raw = String(recipient).trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  return digits || raw;
}

function isMissingColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  const hint = String(error?.hint || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();

  return (
    code === '42703' ||
    message.includes('does not exist') ||
    message.includes('column') ||
    message.includes('schema cache') ||
    details.includes('schema cache') ||
    hint.includes('schema cache')
  );
}

function extractMissingColumn(error) {
  const combined = [error?.message, error?.details, error?.hint].filter(Boolean).join(' | ');
  const patterns = [
    /column ["']?([a-zA-Z0-9_]+)["']? does not exist/i,
    /could not find the ['"]([a-zA-Z0-9_]+)['"] column/i,
    /unknown column ["']?([a-zA-Z0-9_]+)["']?/i,
  ];

  for (const pattern of patterns) {
    const match = combined.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

async function insertAutomationLogWithFallback(supabaseAdmin, payload, context = {}) {
  const safePayload = { ...payload };
  const removedColumns = [];
  const maxAttempts = 6;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from('automation_logs')
      .insert(safePayload)
      .select('id, status')
      .single();

    if (!error) {
      if (removedColumns.length) {
        console.error('[logAutomationDispatch] Insert com fallback após remover colunas inexistentes', {
          removedColumns,
          attempts: attempt,
          workspaceId: context?.workspaceId || null,
          ruleId: context?.ruleId || null,
          entityId: context?.entityId || null,
        });
      }
      return { data, error: null, removedColumns };
    }

    const missingColumn = extractMissingColumn(error);
    const shouldRetry = isMissingColumnError(error) && missingColumn && Object.hasOwn(safePayload, missingColumn);
    if (!shouldRetry) {
      return { data: null, error, removedColumns };
    }

    delete safePayload[missingColumn];
    removedColumns.push(missingColumn);
    console.error('[logAutomationDispatch] Coluna inexistente detectada em automation_logs; aplicando fallback', {
      missingColumn,
      attempt,
      workspaceId: context?.workspaceId || null,
      ruleId: context?.ruleId || null,
      entityId: context?.entityId || null,
      error: error?.message || null,
    });
  }

  return {
    data: null,
    error: { message: 'Falha no fallback de insert após múltiplas tentativas por colunas inexistentes' },
    removedColumns,
  };
}

/**
 * Registra disparo de mensagem em automation_logs
 * @param {Object} params
 * @param {string} params.workspaceId - ID do workspace
 * @param {string} params.ruleId - ID da regra (null se manual)
 * @param {string} params.templateId - ID do template (null se hardcoded)
 * @param {string} params.channelId - ID do canal (null se env vars)
 * @param {string} params.entityId - ID da entidade (invite.id, contract.id)
 * @param {string} params.entityType - Tipo da entidade ('invite', 'contract')
 * @param {string} params.recipientType - Tipo destinatário ('member', 'client', 'admin')
 * @param {string} params.recipient - Número do destinatário
 * @param {string} params.renderedMessage - Mensagem enviada
 * @param {Object} params.metadata - Dados contextuais (event, contact, etc)
 * @param {Object} params.providerResponse - Resposta da API WhatsApp
 * @param {string} params.status - Status ('sent', 'failed', 'skipped')
 * @param {string} params.errorMessage - Mensagem de erro (se houver)
 * @param {string} params.source - Origem ('legacy_send_invite', 'legacy_contract_signed')
 * @returns {Promise<{ok: boolean}>}
 */
export async function logAutomationDispatch({
  workspaceId,
  ruleId,
  templateId,
  channelId,
  entityId,
  entityType,
  recipientType,
  recipient,
  renderedMessage,
  metadata,
  providerResponse,
  status,
  errorMessage,
  source,
}) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const workspace = await resolveWorkspaceSettings(workspaceId);
    const normalizedRecipient = normalizeRecipient(recipient);
    const normalizedStatus = normalizeDispatchStatus(status);

    const payload = {
      workspace_id: workspace.id,
      rule_id: ruleId,
      template_id: templateId,
      channel_id: channelId,
      entity_id: entityId,
      entity_type: entityType,
      recipient_type: recipientType,
      recipient: normalizedRecipient,
      recipient_number: normalizedRecipient,
      rendered_message: renderedMessage,
      metadata,
      provider_response: providerResponse,
      status: normalizedStatus,
      error_message: errorMessage,
      source,
    };

    const { data, error, removedColumns } = await insertAutomationLogWithFallback(supabaseAdmin, payload, {
      workspaceId: workspace.id,
      ruleId,
      entityId,
    });

    console.info('[automation][step] log_insert_result', {
      ok: !error,
      workspaceId: workspace.id,
      ruleId: ruleId || null,
      status: normalizedStatus,
      error: error?.message || null,
      logId: data?.id || null,
      removedColumns,
    });

    if (error) {
      console.error('[logAutomationDispatch] Erro ao registrar log de automação:', {
        message: error?.message || 'Erro desconhecido',
        details: error?.details || null,
        hint: error?.hint || null,
        code: error?.code || null,
      });
      return { ok: false, error: error?.message || 'Erro ao inserir log' };
    }

    console.info('[logAutomationDispatch] log_persisted', {
      logId: data?.id || null,
      status: data?.status || normalizedStatus,
      workspaceId: workspace.id,
      ruleId: ruleId || null,
      source: source || null,
      recipient: normalizedRecipient,
    });

    return { ok: true, logId: data?.id || null };
  } catch (err) {
    console.error('[logAutomationDispatch] Exceção ao registrar log de automação:', err);
    return { ok: false, error: err?.message || 'Exceção ao inserir log' };
  }
}

/**
 * Wrapper obrigatório de logging.
 * Nunca lança exceção e sempre tenta persistir em automation_logs.
 * Caso a persistência falhe, registra fallback explícito em console.error.
 */
export async function safeLogDispatch(params) {
  try {
    const result = await logAutomationDispatch(params);
    if (!result?.ok) {
      console.error('[automation][step] safe_log_dispatch_failed', {
        error: result?.error || 'Falha desconhecida ao salvar log',
        context: {
          workspaceId: params?.workspaceId || null,
          ruleId: params?.ruleId || null,
          entityId: params?.entityId || null,
          status: params?.status || null,
        },
      });

      // Em caso de falha de envio, tentamos mais uma persistência mínima para não perder rastreabilidade.
      if (String(params?.status || '').toLowerCase() === 'failed') {
        const retryPayload = {
          workspaceId: params?.workspaceId || null,
          ruleId: params?.ruleId || null,
          templateId: params?.templateId || null,
          channelId: params?.channelId || null,
          entityId: params?.entityId || null,
          entityType: params?.entityType || null,
          recipientType: params?.recipientType || null,
          recipient: params?.recipient || null,
          renderedMessage: null,
          metadata: {
            ...(params?.metadata || {}),
            retry_mode: 'minimal',
            previous_error: result?.error || null,
          },
          providerResponse: params?.providerResponse || null,
          status: 'failed',
          errorMessage: params?.errorMessage || result?.error || 'Falha de envio sem detalhe',
          source: params?.source || 'automation_center',
        };
        const retryResult = await logAutomationDispatch(retryPayload);
        if (!retryResult?.ok) {
          console.error('[automation][step] safe_log_dispatch_retry_failed', {
            error: retryResult?.error || 'Falha desconhecida no retry de log',
            previousError: result?.error || null,
            context: {
              workspaceId: params?.workspaceId || null,
              ruleId: params?.ruleId || null,
              entityId: params?.entityId || null,
              status: params?.status || null,
            },
          });
        }
      }
    }
    return result;
  } catch (err) {
    console.error('[automation][step] safe_log_dispatch_exception', {
      error: err?.message || 'Exceção desconhecida',
      context: {
        workspaceId: params?.workspaceId || null,
        ruleId: params?.ruleId || null,
        entityId: params?.entityId || null,
        status: params?.status || null,
      },
    });
    return { ok: false, error: err?.message || 'Exceção desconhecida' };
  }
}
