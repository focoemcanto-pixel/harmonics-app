/**
 * Observabilidade opcional no Langfuse via endpoint OpenTelemetry (OTLP/HTTP JSON):
 * POST {LANGFUSE_BASE_URL}/api/public/otel/v1/traces com Basic auth (public:secret).
 * Por padrão envia SOMENTE metadados (modelo, tokens, custo, latência, ferramentas,
 * estratégia, etapa) — nunca o conteúdo das mensagens (LGPD), salvo
 * LANGFUSE_CAPTURE_CONTENT=true. Falhas são ignoradas (nunca bloqueia o atendimento).
 */
function hex(bytes) { return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(''); }
function randomHex(n) { return hex(crypto.getRandomValues(new Uint8Array(n))); }
function attr(key, value) {
  if (typeof value === 'number') return { key, value: Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value } };
  if (typeof value === 'boolean') return { key, value: { boolValue: value } };
  return { key, value: { stringValue: String(value ?? '') } };
}

export function isLangfuseEnabled(env = process.env) {
  return Boolean(env.LANGFUSE_BASE_URL && env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY);
}

export function buildOtlpPayload({ name, startMs, endMs, attributes = {} }) {
  const traceId = randomHex(16);
  const spanId = randomHex(8);
  return {
    resourceSpans: [{
      resource: { attributes: [attr('service.name', 'harmonics-ai-inbox')] },
      scopeSpans: [{
        scope: { name: 'harmonics-ai' },
        spans: [{
          traceId, spanId, name, kind: 1,
          startTimeUnixNano: String(BigInt(Math.round(startMs)) * 1000000n),
          endTimeUnixNano: String(BigInt(Math.round(endMs)) * 1000000n),
          attributes: Object.entries(attributes).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => attr(k, v)),
        }],
      }],
    }],
  };
}

export async function traceAiReply({ env = process.env, fetchImpl = fetch, startMs, endMs = Date.now(), attributes = {}, content = null }) {
  if (!isLangfuseEnabled(env)) return { sent: false, reason: 'disabled' };
  const attrs = { ...attributes };
  if (String(env.LANGFUSE_CAPTURE_CONTENT || '').toLowerCase() === 'true' && content) {
    attrs['input.value'] = String(content.input || '').slice(0, 4000);
    attrs['output.value'] = String(content.output || '').slice(0, 4000);
  }
  const payload = buildOtlpPayload({ name: 'ai.reply', startMs, endMs, attributes: attrs });
  const auth = btoa(`${env.LANGFUSE_PUBLIC_KEY}:${env.LANGFUSE_SECRET_KEY}`);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const response = await fetchImpl(`${String(env.LANGFUSE_BASE_URL).replace(/\/+$/, '')}/api/public/otel/v1/traces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return { sent: response.ok, status: response.status };
  } catch {
    return { sent: false, reason: 'error' };
  }
}

/**
 * Atributos do span de resposta no formato que o Langfuse mapeia nativamente (conferido no
 * OtelIngestionProcessor do Langfuse): geração com modelo, tokens e custo; sessão = id interno
 * da conversa (UUID aleatório, sem telefone/nome). Somente metadados — nada de conteúdo.
 */
export function replyTraceAttributes({ result = {}, conversation = {}, commercial = {}, workspaceId, outcome }) {
  return {
    'langfuse.observation.type': 'generation',
    'session.id': conversation.id || undefined,
    'gen_ai.request.model': result.model, 'gen_ai.usage.input_tokens': result.inputTokens,
    'gen_ai.usage.output_tokens': result.outputTokens, 'gen_ai.usage.cost': result.costUsd, 'harmonics.cost_usd': result.costUsd,
    'harmonics.tools': (result.toolCalls || []).join(','), 'harmonics.strategies': (commercial.strategyKeys || []).join(','),
    'harmonics.stage': conversation.sales_stage, 'harmonics.workspace_id': workspaceId,
    'harmonics.outcome': outcome || 'rejected', 'harmonics.knowledge_count': (commercial.knowledgeIds || []).length,
    'harmonics.payment_rule_approved': Boolean(commercial.paymentApproved),
    'harmonics.memory_fields': Object.keys(conversation.lead_data || {}).length,
    'harmonics.objections': (conversation.objections || []).join(','),
  };
}
