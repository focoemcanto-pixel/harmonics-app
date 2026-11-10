// Respostas para a oferta da tabela, sem linguagem técnica ou promessas de encaminhamento.
// O assistente conduz o contexto; valores só são apresentados quando oficiais.
export function customerQuoteStage({
  city = '', venue = '', locationConfirmed = false,
  table = '', wantsTable = false, hasOfficialPrices = false,
} = {}) {
  if (!locationConfirmed || !city) return null;
  const place = String(city).trim();
  if (!hasOfficialPrices || !table) return {
    kind: 'pending_pricing',
    reply: 'Entendi, o casamento será em ' + place + '! ☺️ Vou precisar conferir as condições para essa cidade antes de te passar valores. Enquanto isso, posso te apresentar as formações da banda, de Duo a Sexteto.',
  };
  if (wantsTable) return {
    kind: 'official_table',
    reply: 'Claro! Separei aqui as opções de cerimônia para ' + place + '. Dá uma olhada: ☺️\n\n' + table,
  };
  return {
    kind: 'offer_table',
    reply: 'Ah, entendi! Então a cerimônia será em ' + place +
      '. ☺️ Temos formações de Duo a Sexteto. Você já tem alguma em mente ou prefere que eu te mande a tabela para comparar?',
  };
}
export function isFullTableRequest(text = '') {
  return /\b(tabela|todos os valores|todas as forma[cç][oõ]es|op[cç][oõ]es com valores|tabela completa)\b/i.test(String(text));
}

/** Quando a tabela é resultado de uma ferramenta, a IA mantém a conversa natural.
 * Rejeita a resposta do modelo se expõe detalhes internos, encerra a conversa
 * ou inventa valores; neste caso usa uma transição comercial simples. */
export function naturalQuoteReply({ aiText = '', city = '', table = '', wantsTable = false } = {}) {
  const fallback = customerQuoteStage({
    city, locationConfirmed: Boolean(city), table, wantsTable, hasOfficialPrices: Boolean(table),
  })?.reply || '';
  const original = String(aiText || '').trim();
  const forbidden = /tabela autom[aá]tica|base (?:de dados|interna)|parametriz|n[aã]o est[aá] cadastrad|precisamos de aprova[cç][aã]o|sistema|ferramenta|simulador|R\s*\$|or[cç]amentos cerim[oô]nia|posso ajudar com mais alguma coisa|j[aá] encaminhei|j[aá] notifiquei/i;
  const safe = original.length > 12 && original.length < 400 && !forbidden.test(original);
  if (!wantsTable) return safe ? original : fallback;
  // A tabela vem sempre da fonte oficial; só uma introdução breve pode vir da IA.
  const intro = original.split(/\n/)[0].trim().slice(0, 180);
  const validIntro = safe && intro.length >= 10 && !/\?/.test(intro);
  return (validIntro ? intro + '\n\n' + table : fallback);
}
