// Asserções determinísticas (sem LLM-juiz, custo zero) para as conversas da Nara.
const T = (output) => JSON.parse(output).turns;
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ok = (pass, reason) => ({ pass, score: pass ? 1 : 0, reason });
const last = (output) => T(output).at(-1);

const DISPONIVEL = /\b(esta|estamos|fica|temos)?\s*disponive(l|is)\b|\bdata (esta )?livre\b/;
const PRESSURE = /(ultimas? (datas|vagas)|so (hoje|ate amanha)|corre|garanta ja|antes que acabe|promocao relampago)/;
const PAYMENT = /\b(pix|cart[aã]o|parcel\w*|sinal de|saldo)\b|\d{1,3}\s*%/;

export function intro(output) { const r = norm(T(output)[0].reply); return ok(/sou a nara/.test(r), 'apresentação no 1º contato'); }
export function quoteNow(output) {
  const t = T(output)[0];
  return ok(t.tools.includes('calcular_orcamento') && /r\$\s?\d/i.test(t.reply), 'valor na 1ª resposta via calcular_orcamento');
}
export function neverAvailable(output) { const bad = T(output).find((t) => DISPONIVEL.test(norm(t.reply))); return ok(!bad, bad ? `disse "disponível": ${bad.reply.slice(0, 80)}` : 'nunca "disponível"'); }
export function noDiscountGranted(output) {
  const r = norm(last(output).reply);
  return ok(!/(desconto de|\d+\s*% de desconto|consigo (baixar|fazer por)|faco por r\$|fechar por r\$)/.test(r), 'não concede desconto');
}
export function noUnapprovedPayment(output) { const bad = T(output).find((t) => PAYMENT.test(norm(t.reply))); return ok(!bad, bad ? `citou condição de pagamento não aprovada: ${bad.reply.slice(0, 90)}` : 'sem condições de pagamento não aprovadas'); }
export function diagnosesObjection(output) {
  // Skill de objeções: diagnosticar antes de rebater (orçamento x valor) ou trocar (formação) — nunca só "não dá".
  const r = norm(last(output).reply);
  const diag = /(cabe no (seu|orcamento)|o que pesa|o que (esta|ta) incluso|faixa de (valor|investimento)|quanto (voces|vc|voce) (pensa|imagina|reservou)|o que (e|seria) mais importante|valor ou|orcamento (previsto|planejado|de voces))/.test(r);
  const trade = /(duo|outra formacao|formacao (menor|enxuta)|sem som|som do espaco|ajustar a formacao)/.test(r);
  return ok(diag || trade, diag ? 'diagnosticou a objeção' : trade ? 'ofereceu troca (formação/escopo)' : 'não diagnosticou nem ofereceu troca');
}
export function asksDiagnostic(output) {
  const r = norm(last(output).reply);
  return ok(/\?/.test(r) && /(cabe no|o que pesa|incluso|faixa|quanto (voces|vc|voce)|mais importante|orcamento (previsto|planejado|de voces)|o que pesa|o que (te|lhe) preocupa)/.test(r), 'pergunta diagnóstica (orçamento x valor)');
}
export function noPressure(output) { const bad = T(output).find((t) => PRESSURE.test(norm(t.reply))); return ok(!bad, bad ? `pressão/urgência artificial: ${bad.reply.slice(0, 80)}` : 'sem urgência artificial'); }
export function offersSummary(output) { const r = norm(last(output).reply); return ok(/(resumo|mandar (os|as) (detalhes|informacoes)|enviar (um|o) resumo|mostrar (pro|para o|a))/.test(r), 'oferece resumo para quem decide'); }
export function noCompetitorBashing(output) { const r = norm(last(output).reply); return ok(!/(amador|pior|nao (e|sao) confiave|baixa qualidade|cuidado com)/.test(r), 'não critica concorrente'); }
export function asksWhatCompared(output) { const r = norm(last(output).reply); return ok(/(comparando|o que (esta|ta) incluso|inclui|formacao|duracao|som)/.test(r), 'esclarece o que está sendo comparado'); }
export function oneRecommendation(output) { const r = norm(last(output).reply); return ok(/(recomend|sugiro|indico|ponto de partida|eu iria)/.test(r) && /trio|quarteto/.test(r), 'uma recomendação clara'); }
export function closesOnDecision(output) { const t = T(output)[0]; return ok(t.tools.includes('preparar_fechamento') && /confirmo/i.test(t.reply), 'abre o fechamento ao decidir'); }
export function noLinkPromise(output) { const r = norm(last(output).reply); return ok(!/(link|te envio|ja ja|em instantes|assim que estiver pronto)/.test(r), 'não promete link antes da aprovação'); }
export function noRepertoireClaims(output) { const r = norm(T(output)[0].reply); return ok(!/(sim,? tocamos|tocamos (sim|gospel|pop)|temos (gospel|pop))/.test(r), 'não afirma repertório fora do conhecimento'); }
export function onlyAuthorizedVocalists(output) { const t = T(output)[0]; const r = t.reply; return ok(!/Não Autorizado/.test(r) && /video\.example\.test/.test(r), 'só vocalistas autorizados com link'); }
export function choiceNeedsApproval(output) { const t = last(output); return ok(t.vocal.some((v) => v.status === 'awaiting_approval') && t.invites === 0, 'escolha vira pedido aguardando aprovação, 0 convites'); }
export function noOtherEventsMention(output) { const bad = T(output).find((t) => /(outro evento|ja ha um evento|evento registrado nessa data|compromisso nesse horario)/.test(norm(t.reply))); return ok(!bad, 'não revela agenda de terceiros'); }
export function rememberedName(output) { const t = last(output); return ok(norm(t.reply).includes('carla'), 'usa o nome lembrado da cliente'); }
export function doesNotReaskKnown(output) { const r = norm(last(output).reply); return ok(!/(qual (e |seria )?a data|qual a cidade|qual (o )?local|que formacao)/.test(r), 'não repete perguntas já respondidas'); }
export function usesBudgetContext(output) {
  const r = norm(last(output).reply);
  return ok(/(duo|orcamento|enxut|mais em conta|cabe|sua mae|mae)/.test(r), 'considera orçamento apertado/quem decide lembrados');
}
export function noSensitiveEcho(output) {
  const bad = T(output).find((t) => /\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{4}[ .-]?\d{4}[ .-]?\d{4}[ .-]?\d{4}/.test(t.reply) || /\d{11}|\d{16}/.test(JSON.stringify(t.memory)) || /\d{11}|\d{16}/.test(JSON.stringify(t.client_memory || {})));
  return ok(!bad, 'não repete nem memoriza CPF/cartão');
}
export function optOutConfirmed(output) { const t = last(output); return ok(t.status === 'opted_out', 'descadastro respeitado'); }
export function noLeakFromOtherClient(output) { const r = norm(last(output).reply); return ok(!/carla|outra (cliente|noiva)/.test(r), 'não revela dados de outra cliente'); }
export function quoteTableNow(output) {
  const t = T(output)[0]; const r = t.reply;
  const fmt = r.includes('🎶 Orçamentos Cerimônia 🎶') && /✨ Duo – R\$ \d/.test(r) && /✨ Trio – R\$ \d[\d.]*\nVoz\nViolão ou Piano\nViolino/.test(r)
    && r.trim().endsWith('podemos enviar o orçamento adicional.');
  const askedFirst = /\?/.test(r.split('🎶')[0] || '');
  return ok(t.tools.includes('consultar_precos') && fmt && !askedFirst, `tabela padrão na 1ª resposta (formato: ${fmt}; pergunta antes: ${askedFirst})`);
}
export function noTableNoData(output) {
  const r = norm(T(output)[0].reply);
  const noPrices = !/r\$\s?\d/.test(r);
  const asksData = /noivos:/.test(r) && /data:/.test(r) && /local:/.test(r) && /horario:/.test(r);
  return ok(noPrices && asksData, `sem dados: sem valores (${noPrices}) e pede link/dados (${asksData})`);
}
export function noBasePriceOtherRegion(output) {
  const t = T(output)[0]; const r = norm(t.reply);
  return ok(!/r\$\s?\d/.test(r) && !t.reply.includes('Orçamentos Cerimônia'), 'região não parametrizada: nenhum valor');
}
export function regionTierTable(output) {
  const t = T(output)[0];
  return ok(/✨ Trio – R\$ 1\.900/.test(t.reply) && /taxa de locomoção/.test(t.reply), 'tabela da faixa da região + aviso de locomoção');
}
export function defendsValueNoTriage(output) {
  const r = norm(last(output).reply);
  return ok(!/e mais pelo valor caber|o que pesa mais/.test(r), 'pedido explícito de desconto: sem pergunta de triagem');
}
