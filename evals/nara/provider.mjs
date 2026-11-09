// Provider do Promptfoo: conversa de vários turnos com a Nara pelo pipeline real de simulação
// (rota /api/sim/nara de uma PRÉVIA *.workers.dev; nunca produção, nunca WhatsApp).
// Requer NARA_SIM_URL e NARA_SIM_TOKEN no ambiente. A saída é JSON com respostas e efeitos por turno.
import { fixtures, SIM_TODAY } from './fixtures.mjs';

// Falhas de rede transitórias (proxy/TLS) não são comportamento da Nara: até 3 tentativas.
async function postWithRetry(url, token, payload, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-sim-token': token }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => ({}));
      if (res.status >= 500 && i < attempts - 1) { await new Promise((r) => setTimeout(r, 1500 * (i + 1))); continue; }
      return { res, body };
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastError;
}

export default class NaraSimProvider {
  constructor(options = {}) { this.label = options.label || 'nara-sim'; }
  id() { return this.label; }

  async callApi(_prompt, context) {
    const url = process.env.NARA_SIM_URL;
    const token = process.env.NARA_SIM_TOKEN;
    if (!url || !token) return { error: 'Defina NARA_SIM_URL e NARA_SIM_TOKEN (prévia de simulação).' };
    if (!/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev\//.test(url)) return { error: 'NARA_SIM_URL deve ser uma prévia *.workers.dev.' };
    const turnsIn = JSON.parse(context.vars.turns_json || '[]');
    const messages = []; let state = {}; const turns = []; let cost = 0; let tokens = 0;
    for (const text of turnsIn) {
      messages.push({ role: 'customer', text });
      const { res, body } = await postWithRetry(url, token, { messages, state, fixtures, today: SIM_TODAY });
      if (!body.ok) return { error: `sim ${res.status}: ${body.error || 'falha'}` };
      cost += body.usage?.costUsd || 0;
      tokens += (body.usage?.inputTokens || 0) + (body.usage?.outputTokens || 0);
      turns.push({
        customer: text, reply: body.reply || '', status: body.status, reason: body.reason || null,
        tools: (body.tools || []).map((t) => t.name), approvals: (body.approvals || []).map((a) => a.kind),
        vocal: body.vocalist_requests || [], invites: body.invites_created || 0, strategies: body.strategies || [],
        memory: body.state?.lead_data || {}, client_memory: body.client_memory || null,
      });
      if (body.reply) messages.push({ role: 'assistant', text: body.reply });
      state = body.state || state;
      if (body.status === 'skipped') break;
    }
    return { output: JSON.stringify({ turns }), cost, tokenUsage: { total: tokens } };
  }
}
