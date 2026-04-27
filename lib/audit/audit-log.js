import { logError, logWarn, maskToken } from '@/lib/observability/server-log';

const MAX_METADATA_KEYS = 40;
const MAX_STRING_LEN = 500;

const BLOCKED_KEY_PATTERNS = [
  /password/i,
  /senha/i,
  /token/i,
  /secret/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /action[_-]?link/i,
  /signedhtml/i,
  /signed_html/i,
  /raw[_-]?payload/i,
];

function asString(value) {
  return String(value ?? '').trim();
}

function maskCpf(value) {
  const digits = asString(value).replace(/\D/g, '');
  if (digits.length !== 11) return '***.***.***-**';
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
}

function shouldBlockKey(key) {
  const normalized = asString(key);
  return BLOCKED_KEY_PATTERNS.some((pattern) => pattern.test(normalized));
}

function sanitizeValue(key, value) {
  const keyName = asString(key);

  if (shouldBlockKey(keyName)) return '[redacted]';

  if (value == null) return null;

  if (typeof value === 'string') {
    if (/cpf/i.test(keyName)) return maskCpf(value);

    const normalized = value.trim();
    if (normalized.length > MAX_STRING_LEN) {
      return `${normalized.slice(0, MAX_STRING_LEN)}...[truncated]`;
    }

    return normalized;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(keyName, item));
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value).slice(0, MAX_METADATA_KEYS);
    return entries.reduce((acc, [nestedKey, nestedValue]) => {
      if (shouldBlockKey(nestedKey)) {
        acc[nestedKey] = '[redacted]';
      } else {
        acc[nestedKey] = sanitizeValue(nestedKey, nestedValue);
      }
      return acc;
    }, {});
  }

  return asString(value).slice(0, MAX_STRING_LEN);
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return {};

  const entries = Object.entries(metadata).slice(0, MAX_METADATA_KEYS);
  return entries.reduce((acc, [key, value]) => {
    acc[key] = sanitizeValue(key, value);
    return acc;
  }, {});
}

function normalizeAuditRecord(input) {
  return {
    actor_user_id: asString(input.actorUserId) || null,
    actor_email: asString(input.actorEmail).toLowerCase() || null,
    action: asString(input.action) || 'unknown_action',
    entity_type: asString(input.entityType) || null,
    entity_id: asString(input.entityId) || null,
    status: asString(input.status) || 'success',
    ip: asString(input.ip) || null,
    user_agent: asString(input.userAgent) || null,
    metadata: sanitizeMetadata(input.metadata),
  };
}

export async function writeAuditLog({
  supabase,
  actorUserId,
  actorEmail,
  action,
  entityType,
  entityId,
  status,
  ip,
  userAgent,
  metadata,
}) {
  if (!supabase) {
    logWarn('AUDIT_LOG', 'SKIP_NO_SUPABASE', { action });
    return;
  }

  const record = normalizeAuditRecord({
    actorUserId,
    actorEmail,
    action,
    entityType,
    entityId,
    status,
    ip,
    userAgent,
    metadata,
  });

  if (!record.action) {
    logWarn('AUDIT_LOG', 'SKIP_INVALID_ACTION', { action });
    return;
  }

  try {
    const { error } = await supabase.from('audit_logs').insert(record);

    if (error) {
      logWarn('AUDIT_LOG', 'WRITE_FAILED', {
        action: record.action,
        entityType: record.entity_type,
        entityId: record.entity_id,
        error: error.message,
      });
    }
  } catch (error) {
    logError('AUDIT_LOG', 'WRITE_EXCEPTION', error, {
      action: record.action,
      entityType: record.entity_type,
      entityId: record.entity_id,
      tokenHint: maskToken(record.entity_id),
    });
  }
}
