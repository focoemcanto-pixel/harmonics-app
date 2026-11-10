// Política comercial: sem encerrar negociação pendente nem prometer encaminhamentos não executados.
// A localização validada precede qualquer escolha de formação ou preço.
export function customerQuoteStage({ city = '', venue = '', locationConfirmed = false, table = '', wantsTable = false, hasOfficialPrices = false } = {}) {
  if (!locationConfirmed || !city) return null;
  if (!hasOfficialPrices || !table) {
    return {
      kind: 'pending_pricing',
      reply: 'Consegui confirmar que o local fica em ' + city + '. ☺️ Para passar valores corretos, ainda precisamos validar as condições de atendimento nessa região. Trabalhamos com Duo, Trio, Quarteto, Quinteto e Sexteto. Posso te explicar as diferenças entre essas formações?',
    };
  }
  if (wantsTable) {
    return { kind: 'official_table', reply: table };
  }
  return {
    kind: 'offer_table',
    reply: 'Perfeito! ☺️ Confirmei a localidade do evento' + (venue ? ' no ' + venue : '') +
      '. Você já tem uma formação em mente, como Duo ou Trio, ou prefere que eu envie a tabela completa para você comparar?',
  };
}
export function isFullTableRequest(text = '') {
  return /\b(tabela|todos os valores|todas as forma[cç][oõ]es|op[cç][oõ]es com valores|tabela completa)\b/i.test(String(text));
}
