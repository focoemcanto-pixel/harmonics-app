// Validação do destinatário antes de chamar o provider de WhatsApp.
//
// Motivo: a WaSender responde 422 "The provided JID does not exist on WhatsApp." para números
// que não têm WhatsApp. Sem memória disso, o cron voltava a tentar o mesmo número a cada
// execução e cada tentativa virava um log 'failed' (3x o mesmo número entre 25/09 e 08/10).
// Agora: formato inválido ou número já recusado recentemente => log 'skipped' com motivo claro,
// sem chamada ao provider.
//
// O formato enviado ao provider NÃO muda (os envios atuais com DDD+número, sem 55, funcionam).

export const KNOWN_INVALID_JID_WINDOW_DAYS = 30;

// Só os fluxos agendados (cron), onde o mesmo número era re-tentado a cada execução.
// Fluxos instantâneos (convite, contrato assinado, revisões) mantêm o comportamento anterior:
// os chamadores deles só tratam sent/failed/sem regra (ex.: lock do convite, flag whatsapp_signed_sent).
const GUARDED_EVENT_TYPES = new Set([
  'repertoire_pending_15_days_client',
  'payment_pending_2_days_client',
  'post_event_review_request_client',
  'schedule_pending_15_days_admin',
  'event_day_confirmation_client',
  'schedule_no_response_member',
]);

export function shouldGuardRecipient(eventType) {
  return GUARDED_EVENT_TYPES.has(eventType);
}

const INVALID_JID_PATTERN = /JID does not exist|(?:is )?not (?:registered |exist(?:s|ing)? )?on WhatsApp/i;

export const RECIPIENT_SKIP_REASONS = {
  missing: 'recipient_missing',
  invalidFormat: 'recipient_invalid_format',
  knownInvalidJid: 'recipient_not_on_whatsapp',
};

function digitsOf(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidBrazilianDdd(ddd) {
  // DDDs brasileiros vão de 11 a 99 e não têm dígito 0.
  return /^[1-9][1-9]$/.test(ddd);
}

/**
 * Valida o formato do número (apenas dígitos).
 * Aceita: DDD + número (10/11 dígitos) ou 55 + DDD + número (12/13 dígitos).
 * Celular com 11 dígitos precisa começar com 9 após o DDD.
 */
export function validateWhatsAppRecipient(value) {
  const digits = digitsOf(value);
  if (!digits) {
    return { ok: false, digits, reason: RECIPIENT_SKIP_REASONS.missing, message: 'Destinatário sem número de WhatsApp.' };
  }

  const invalid = (detail) => ({
    ok: false,
    digits,
    reason: RECIPIENT_SKIP_REASONS.invalidFormat,
    message: `Número de WhatsApp inválido (${detail}); envio não realizado. Corrija o telefone do cadastro.`,
  });

  let national = digits;
  if (digits.length === 12 || digits.length === 13) {
    if (!digits.startsWith('55')) return invalid(`${digits.length} dígitos sem código do país 55`);
    national = digits.slice(2);
  } else if (digits.length !== 10 && digits.length !== 11) {
    return invalid(`${digits.length} dígitos`);
  }

  if (!isValidBrazilianDdd(national.slice(0, 2))) return invalid('DDD inválido');
  if (national.length === 11 && national[2] !== '9') return invalid('celular com 11 dígitos deve começar com 9');

  return { ok: true, digits, reason: null, message: null };
}

export function isInvalidJidMessage(value) {
  return INVALID_JID_PATTERN.test(String(value || ''));
}

/**
 * Procura falha recente do provider dizendo que o número não existe no WhatsApp.
 * Só falhas reais do provider ('failed') contam; os 'skipped' gerados por esta guarda não
 * renovam a janela, então após KNOWN_INVALID_JID_WINDOW_DAYS o número é tentado de novo.
 */
export async function findRecentInvalidJidFailure({
  supabase,
  workspaceId,
  recipient,
  windowDays = KNOWN_INVALID_JID_WINDOW_DAYS,
  now = new Date(),
}) {
  const digits = digitsOf(recipient);
  if (!supabase || !workspaceId || !digits) return null;

  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('automation_logs')
    .select('id, created_at, error_message')
    .eq('workspace_id', workspaceId)
    .eq('recipient_number', digits)
    .eq('status', 'failed')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data || []).find((row) => isInvalidJidMessage(row?.error_message)) || null;
}

/**
 * Decide se o envio para `recipient` deve acontecer.
 * Falha na consulta ao banco nunca bloqueia o envio (fail-open).
 */
export async function checkRecipientBeforeSend({ supabase, workspaceId, recipient, now }) {
  const format = validateWhatsAppRecipient(recipient);
  if (!format.ok) return format;

  try {
    const previous = await findRecentInvalidJidFailure({ supabase, workspaceId, recipient: format.digits, now });
    if (previous) {
      const failedAt = String(previous.created_at || '').slice(0, 10);
      return {
        ok: false,
        digits: format.digits,
        reason: RECIPIENT_SKIP_REASONS.knownInvalidJid,
        previousLogId: previous.id,
        message: `Número sem WhatsApp segundo o provider (falha de ${failedAt || 'data desconhecida'}); envio não repetido. Corrija o telefone do cadastro.`,
      };
    }
  } catch (error) {
    console.warn('[automation][recipient_guard] lookup_failed_allowing_send', {
      workspaceId,
      error: error?.message || String(error),
    });
  }

  return format;
}
