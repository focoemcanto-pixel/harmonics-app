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
