/**
 * Adaptador LLM (OpenAI Responses API — o mesmo provedor/credencial já usados no app).
 * Faz o laço de function calling com limite de iterações e estima custo por tokens.
 */
const DEFAULT_MODEL = 'gpt-4.1-mini';
const DEFAULT_TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe';
const MAX_TOOL_ROUNDS = 4;
const TIMEOUT_MS = 25_000;

// USD por 1M tokens (entrada, saída). Sobrescrevível por env AI_PRICE_<MODELO>="in,out".
const PRICES = {
  'gpt-4.1-mini': [0.4, 1.6],
  'gpt-4.1': [2.0, 8.0],
  'gpt-4o-mini': [0.15, 0.6],
};

export function estimateCostUsd(model, inputTokens, outputTokens, env = process.env) {
  const override = env[`AI_PRICE_${String(model).toUpperCase().replace(/[^A-Z0-9]/g, '_')}`];
  const [pin, pout] = override ? override.split(',').map(Number) : (PRICES[model] || PRICES[DEFAULT_MODEL]);
  return ((Number(inputTokens) || 0) * pin + (Number(outputTokens) || 0) * pout) / 1_000_000;
}

function extractText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim();
  for (const item of payload?.output || []) {
    if (item?.type === 'message') {
      const part = (item.content || []).find((c) => typeof c?.text === 'string' && c.text.trim());
      if (part) return part.text.trim();
    }
  }
  return '';
}

async function callResponses({ apiKey, body, fetchImpl }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`llm_http_${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @returns {{ text: string, model: string, inputTokens: number, outputTokens: number, costUsd: number, toolCalls: string[] }}
 */
export async function generateReply({ system, input, tools, executeTool, env = process.env, fetchImpl = fetch }) {
  const apiKey = String(env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('llm_not_configured');
  const model = String(env.AI_INBOX_MODEL || DEFAULT_MODEL).trim();

  const conversation = [...input];
  let inputTokens = 0;
  let outputTokens = 0;
  const toolCalls = [];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    const payload = await callResponses({
      apiKey,
      fetchImpl,
      body: {
        model,
        instructions: system,
        input: conversation,
        tools: round < MAX_TOOL_ROUNDS ? tools : [],
        temperature: 0.5,
        max_output_tokens: 350,
        store: false,
      },
    });
    inputTokens += Number(payload?.usage?.input_tokens || 0);
    outputTokens += Number(payload?.usage?.output_tokens || 0);

    const calls = (payload?.output || []).filter((item) => item?.type === 'function_call');
    if (!calls.length) {
      return { text: extractText(payload), model, inputTokens, outputTokens, costUsd: estimateCostUsd(model, inputTokens, outputTokens, env), toolCalls };
    }
    for (const call of calls) {
      conversation.push({ type: 'function_call', call_id: call.call_id, name: call.name, arguments: call.arguments });
      let args = {};
      try { args = JSON.parse(call.arguments || '{}'); } catch { args = {}; }
      toolCalls.push(call.name);
      const result = await executeTool(call.name, args);
      conversation.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) });
    }
  }
  return { text: '', model, inputTokens, outputTokens, costUsd: estimateCostUsd(model, inputTokens, outputTokens, env), toolCalls };
}

/** Transcrição de áudio (mensagens de voz). */
export async function transcribeAudio({ bytes, mime, env = process.env, fetchImpl = fetch }) {
  const apiKey = String(env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('llm_not_configured');
  const model = String(env.AI_INBOX_TRANSCRIBE_MODEL || DEFAULT_TRANSCRIBE_MODEL).trim();
  const form = new FormData();
  const ext = /ogg|opus/.test(mime) ? 'ogg' : /mpeg|mp3/.test(mime) ? 'mp3' : /mp4|m4a|aac/.test(mime) ? 'm4a' : 'ogg';
  form.append('file', new Blob([bytes], { type: mime }), `audio.${ext}`);
  form.append('model', model);
  form.append('language', 'pt');
  const response = await fetchImpl('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) throw new Error(`transcribe_http_${response.status}`);
  const payload = await response.json();
  // Estimativa conservadora (~US$0,003/min; ~16KB/s em opus).
  const minutes = Math.max(1, Math.ceil((bytes?.byteLength || 0) / (16_000 * 60)));
  return { text: String(payload?.text || '').trim(), model, costUsd: minutes * 0.003 };
}
