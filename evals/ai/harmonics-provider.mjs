// Provider promptfoo (JS local): avalia o comportamento DETERMINÍSTICO da IA comercial
// (sem LLM, sem custo). Cenários sintéticos. Uso: npm run eval:ai
import { register } from 'node:module';

// Mesmo resolvedor de imports do app usado no `npm test` (alias @/ e extensões omitidas).
register('../../tests/helpers/alias-loader.mjs', import.meta.url);
const load = async () => ({
  ...(await import('../../lib/ai/commercial/closing.mjs')),
  ...(await import('../../lib/ai/agent/policy.mjs')),
  ...(await import('../../lib/ai/commercial/strategies.mjs')),
  ...(await import('../../lib/ai/commercial/pricing.mjs')),
  ...(await import('../../lib/ai/commercial/memory.mjs')),
});

const TABLES = {
  rules: [
    { category: 'ceremony', item_key: 'trio', amount: 3000, valid_from: '2020-01-01' },
    { category: 'reception', item_key: 'duo_2h', amount: 1200, valid_from: '2020-01-01' },
  ],
  areas: [{ name: 'Cidade Base', status: 'served', active: true }, { name: 'Cidade Bloqueada', status: 'blocked', active: true }],
};

export default class HarmonicsDeterministicProvider {
  id() { return 'harmonics-deterministic'; }
  async callApi(_prompt, context) {
    const { scenario, text, stage, quote } = context.vars;
    const { classifyConfirmation, detectOptOut, detectHandoffTrigger, selectStrategies, calculateQuote, extractSignals, stripUnapprovedPaymentClaims, isSensitiveValue } = await load();
    let output;
    if (scenario === 'confirmation') output = classifyConfirmation(text);
    else if (scenario === 'optout') output = detectOptOut(text) ? 'optout' : 'continue';
    else if (scenario === 'handoff') output = detectHandoffTrigger(text)?.reason || 'ai';
    else if (scenario === 'strategy') output = selectStrategies({ stage, text }).join(',');
    else if (scenario === 'quote') output = JSON.stringify(calculateQuote(JSON.parse(quote), TABLES));
    else if (scenario === 'signals') output = JSON.stringify(extractSignals(text));
    else if (scenario === 'payment') output = stripUnapprovedPaymentClaims(text, { paymentApproved: false });
    else if (scenario === 'sensitive') output = String(isSensitiveValue(text));
    else output = 'unknown_scenario';
    return { output };
  }
}
