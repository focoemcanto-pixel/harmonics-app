/**
 * Micro-playbooks de vendas consultivas, carregados SOB DEMANDA (1–2 por resposta).
 * Adaptados e condensados para atendimento de música para eventos em PT-BR a partir de:
 *  - jmbluhm/b2b-sales-skills (Apache-2.0): chris-voss-framework, spin-selling,
 *    laer-framework, feel-felt-found, objection-scripts.
 *  - TheCraigHewitt/skills (MIT): sales/objection-handling (ACRC), sales/negotiation,
 *    sales/outbound-sequence.
 *  - mbfinotti/sales-skills (MIT): sales-discovery-questions (espinha dor → impacto → urgência,
 *    uma ideia por pergunta), sales-objection-handling (diagnosticar antes de rebater, triagem de
 *    preço valor × orçamento, modo indecisão/JOLT, repetição = parar de rebater) e
 *    negotiation-concession-planner (trocar em vez de ceder; nada de concessão unilateral).
 * Alterações: tradução, redução a regras de 1–3 linhas, remoção de táticas de pressão,
 * proibição de desconto/urgência artificial. Nenhuma regra comercial (preço, pagamento, política)
 * vem daqui: só técnica de conversa. Ver lib/ai/commercial/THIRD_PARTY.md.
 */
export const STRATEGIES = Object.freeze({
  discovery: {
    label: 'Descoberta (SPIN leve)',
    when: ['new', 'qualifying'],
    text: 'Faça UMA pergunta por vez, aberta antes de fechada e sobre fatos reais (não hipóteses): tipo de evento e data → local → o momento que mais importa para eles (entrada, cortejo, saída, recepção) → como imaginam a música. Use as palavras da cliente; não apresente a banda antes de entender o que ela quer. Não peça o que já está na memória.',
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
    label: 'Negociação (ordem do Manual)',
    when: ['proposal', 'negotiation'],
    signals: /\b(caro|car[ao]s|alto|puxado|acima do|orcamento apertado|orçamento apertado|nao cabe|não cabe|mais em conta|desconto|abatimento|mais barato|baixar o (valor|preco|preço))\b/i,
    text: 'Diagnostique ANTES de rebater, um passo por mensagem: 0) se ainda não sabe o motivo ("tá caro" sem contexto), faça UMA pergunta de triagem: "É mais pelo valor caber no orçamento de vocês ou por entender melhor o que está incluso?" — sem oferecer nada ainda. Se for VALOR: ligue a proposta ao que a cliente disse que mais importa (memória) e ao que está incluso. Se for ORÇAMENTO: troque escopo, não preço — 1) acolha; 2) apresente as facilidades de pagamento EXATAMENTE como estão no conhecimento aprovado (percentuais, prazos e meios de pagamento só de lá); 3) sugira outra formação real da tabela (Trio é ótimo ponto de partida; Duo para orçamento restrito, nunca como inferior); 4) só na última tentativa, com interesse concreto e diferença pequena, chame solicitar_aprovacao (tipo discount). Nunca conceda desconto nem diga que "não há margem".',
    // Sem regra de pagamento ATIVA: não há facilidade de pagamento para oferecer.
    textWithoutPayment: 'Diagnostique ANTES de rebater, um passo por mensagem: 0) se ainda não sabe o motivo ("tá caro" sem contexto), faça UMA pergunta de triagem: "É mais pelo valor caber no orçamento de vocês ou por entender melhor o que está incluso?" — sem oferecer nada ainda. Se for VALOR: ligue a proposta ao que a cliente disse que mais importa (memória) e ao que está incluso. Se for ORÇAMENTO: troque escopo, não preço — 1) acolha; 2) diga que as condições de pagamento são enviadas pela equipe junto com a proposta (NÃO cite percentuais, prazos, entrada, parcelas, Pix ou cartão); 3) sugira outra formação real da tabela (Trio é ótimo ponto de partida; Duo para orçamento restrito, nunca como inferior); 4) só na última tentativa, com interesse concreto e diferença pequena, chame solicitar_aprovacao (tipo discount). Nunca conceda desconto nem diga que "não há margem".',
  },
  indecision: {
    label: 'Indecisão (medo de errar)',
    when: ['qualifying', 'proposal', 'negotiation', 'closing'],
    signals: /\b(medo de (errar|escolher)|nao sei (se|qual)|não sei (se|qual)|em duvida|em dúvida|indecis\w*|estou entre|to entre|tô entre|qual (voce|você|vc) (indica|recomenda)|o que (voce|você|vc) (indica|recomenda))\b/i,
    text: 'A cliente tem medo de errar: NÃO faça mais perguntas nem abra mais opções. Dê UMA recomendação clara e segura com o porquê em uma frase (para cerimônia, o Trio é o ponto de partida equilibrado; Quarteto quando querem mais presença; Duo para algo intimista), diga que ela já tem o suficiente para decidir e ofereça o valor da opção recomendada (calcular_orcamento) se data e local forem conhecidos. Sem urgência, sem promessas fora do conhecimento aprovado.',
  },
  formation_guidance: {
    label: 'Orientação de formação',
    when: ['qualifying', 'proposal'],
    signals: /\b(qual forma|que forma|indecis|não sei qual|nao sei qual|me indica|recomenda|sugere)\b/i,
    text: 'Quando o cliente não sabe escolher, sugira o Trio como ponto de partida equilibrado; Quarteto ou maior para mais presença; Duo para evento intimista. Formações pequenas devem ter base harmônica (teclado/piano ou violão). Não decida só pelo número de convidados.',
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
    || (key === 'indecision' && (allowed.has('discovery') || allowed.has('price_objection')))
    || (key.endsWith('_objection') && allowed.has('price_objection')) || (key === 'formation_guidance' && allowed.has('discovery'));
  const bySignal = Object.entries(STRATEGIES)
    .filter(([key, s]) => s.signals && s.signals.test(text) && ok(key))
    .map(([key]) => key);
  const byStage = Object.entries(STRATEGIES)
    .filter(([key, s]) => !s.signals && s.when.includes(stage) && ok(key))
    .map(([key]) => key);
  return [...new Set([...bySignal, ...byStage])].slice(0, max);
}

const REPEATED = 'ATENÇÃO: a cliente repetiu uma objeção já tratada. Não repita o mesmo argumento nem insista: reconheça, pergunte o que ainda pesa para ela e, se o impasse continuar, ofereça que a equipe avalie (solicitar_aprovacao) ou transfira (transferir_para_humano).';

export function formatStrategiesForPrompt(keys = [], { paymentApproved = true, repeatedObjection = null } = {}) {
  const lines = keys.map((k) => {
    const s = STRATEGIES[k];
    return `- ${s.label}: ${!paymentApproved && s.textWithoutPayment ? s.textWithoutPayment : s.text}`;
  });
  if (repeatedObjection) lines.push(`- ${REPEATED}`);
  return lines.join('\n');
}

/** Objeções para o CRM (determinístico). */
export function detectObjections(text) {
  const out = [];
  if (STRATEGIES.price_objection.signals.test(text)) out.push(/desconto|abatimento|mais barato|baixar/i.test(text) ? 'discount' : 'price');
  if (STRATEGIES.comparison_objection.signals.test(text)) out.push('competitor');
  if (STRATEGIES.stall_objection.signals.test(text)) out.push('stall');
  if (/\b(data|dia) .{0,20}(nao|não) (serve|da|dá)|outra data\b/i.test(text)) out.push('date');
  return out;
}
