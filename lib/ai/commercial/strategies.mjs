/**
 * Micro-playbooks de vendas consultivas, carregados SOB DEMANDA (1–2 por resposta).
 * Adaptados e condensados para atendimento de música para eventos em PT-BR a partir de:
 *  - jmbluhm/b2b-sales-skills (Apache-2.0): chris-voss-framework, spin-selling,
 *    laer-framework, feel-felt-found, objection-scripts.
 *  - TheCraigHewitt/skills (MIT): sales/objection-handling (ACRC), sales/negotiation,
 *    sales/outbound-sequence.
 * Alterações: tradução, redução a regras de 1–3 linhas, remoção de táticas de pressão,
 * proibição de desconto/urgência artificial. Ver lib/ai/commercial/THIRD_PARTY.md.
 */
export const STRATEGIES = Object.freeze({
  discovery: {
    label: 'Descoberta (SPIN leve)',
    when: ['new', 'qualifying'],
    text: 'Faça UMA pergunta por vez, da situação para a necessidade: tipo de evento e data → local → momento mais importante (entrada, cortejo, recepção) → como imaginam a música. Não peça o que o cliente já disse.',
  },
  empathy: {
    label: 'Empatia tática (Chris Voss)',
    when: ['qualifying', 'proposal', 'negotiation'],
    text: 'Antes de responder uma preocupação, nomeie-a com leveza ("Parece que o orçamento está apertado…", "Imagino que queira ter certeza da qualidade…") e só então siga. Nunca diga "eu entendo" de forma vazia.',
  },
  calibrated_questions: {
    label: 'Perguntas calibradas (Voss)',
    when: ['negotiation', 'proposal'],
    text: 'Prefira perguntas abertas "como/o quê": "O que é mais importante pra vocês nesse momento?", "Como podemos deixar isso mais confortável pra vocês?". Evite perguntas de sim/não sob pressão.',
  },
  price_objection: {
    label: 'Objeção de preço (ACRC/LAER)',
    when: ['proposal', 'negotiation'],
    signals: /\b(caro|car[ao]s|alto|puxado|acima do|orcamento apertado|orçamento apertado|nao cabe|não cabe|mais em conta)\b/i,
    text: 'Acolha ("faz sentido querer avaliar bem"), pergunte o que pesa mais (valor total, formação, receptivo) e apresente alternativas REAIS da tabela (outra formação, sem receptivo, sem som). Nunca ofereça desconto; pedido de desconto vai para a equipe.',
  },
  comparison_objection: {
    label: 'Comparação com concorrente',
    when: ['proposal', 'negotiation'],
    signals: /\b(outra banda|outro grupo|concorr|orcamento de outro|orçamento de outro|achei mais barato|outro lugar)\b/i,
    text: 'Não critique concorrentes. Pergunte o que estão comparando (formação, duração, som, logística) e esclareça o que está incluso no Harmonics com dados oficiais.',
  },
  stall_objection: {
    label: 'Vou pensar / falar com noivo(a)',
    when: ['proposal', 'negotiation', 'closing'],
    signals: /\b(vou pensar|vou ver|falar com (meu|minha)|conversar com (meu|minha)|depois te (falo|aviso)|ainda decidindo)\b/i,
    text: 'Respeite o tempo. Pergunte com leveza se ficou alguma dúvida que ajude na decisão e ofereça mandar um resumo para mostrar a quem decide. Sem urgência artificial.',
  },
  closing: {
    label: 'Fechamento consultivo',
    when: ['proposal', 'negotiation', 'closing'],
    signals: /\b(quero fechar|vamos fechar|pode reservar|quero contratar|como faco pra contratar|como faço para contratar|fechado|bora)\b/i,
    text: 'Quando o cliente decidir, chame preparar_fechamento com os dados confirmados. Não confirme reserva antes do pré-contrato.',
  },
  post_sale: {
    label: 'Pós-venda',
    when: ['contract_sent', 'won', 'post_sale'],
    text: 'Cliente contratado: responda dúvidas de repertório, pagamentos e reunião com o conhecimento cadastrado e o link individual do painel (obter_link_cliente). Nunca use link de outro cliente.',
  },
});

/** Seleciona até `max` estratégias pelo estágio + sinais do texto, respeitando as habilitadas. */
export function selectStrategies({ stage = 'new', text = '', enabled = null, max = 2 } = {}) {
  const allowed = enabled && enabled.length ? new Set(enabled) : null;
  const ok = (key) => !allowed || allowed.has(key) || (key === 'calibrated_questions' && allowed.has('empathy'))
    || (key.endsWith('_objection') && allowed.has('price_objection'));
  const bySignal = Object.entries(STRATEGIES)
    .filter(([key, s]) => s.signals && s.signals.test(text) && ok(key))
    .map(([key]) => key);
  const byStage = Object.entries(STRATEGIES)
    .filter(([key, s]) => !s.signals && s.when.includes(stage) && ok(key))
    .map(([key]) => key);
  return [...new Set([...bySignal, ...byStage])].slice(0, max);
}

export function formatStrategiesForPrompt(keys = []) {
  return keys.map((k) => `- ${STRATEGIES[k].label}: ${STRATEGIES[k].text}`).join('\n');
}

/** Objeções para o CRM (determinístico). */
export function detectObjections(text) {
  const out = [];
  if (STRATEGIES.price_objection.signals.test(text)) out.push('price');
  if (STRATEGIES.comparison_objection.signals.test(text)) out.push('competitor');
  if (STRATEGIES.stall_objection.signals.test(text)) out.push('stall');
  if (/\b(data|dia) .{0,20}(nao|não) (serve|da|dá)|outra data\b/i.test(text)) out.push('date');
  return out;
}
