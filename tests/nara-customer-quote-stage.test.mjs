import test from 'node:test';
import assert from 'node:assert/strict';
import { customerQuoteStage, isFullTableRequest, naturalQuoteReply } from '../lib/ai/commercial/customer-quote-stage.mjs';

test('um CEP verificado sem tabela aprovada não inventa valores ou encerra atendimento', () => {
  const r = customerQuoteStage({ city: 'Feira de Santana', venue: 'Chácara Beatriz',
    locationConfirmed: true, wantsTable: true, hasOfficialPrices: false });
  assert.equal(r.kind, 'pending_pricing');
  assert.match(r.reply, /Feira de Santana/);
  assert.doesNotMatch(r.reply, /tabela automática|não temos tabela|Posso ajudar com mais alguma coisa|já enviei|equipe vai retornar/i);
  assert.match(r.reply, /Duo a Sexteto/);
});
test('local verificado com tabela aprovada permite oferecer tabela ou enviar completa', () => {
  const table = '✨ Duo – R$ 1.300\n✨ Trio – R$ 1.900';
  const offer = customerQuoteStage({ city: 'Salvador', venue: 'Espaço Aliança',
    locationConfirmed: true, table, hasOfficialPrices: true });
  assert.equal(offer.kind, 'offer_table');
  assert.match(offer.reply, /tabela completa/);
  const send = customerQuoteStage({ city: 'Salvador', locationConfirmed: true,
    table, wantsTable: true, hasOfficialPrices: true });
  assert.equal(send.kind, 'official_table');
  assert.match(send.reply, /Separei aqui as opções de cerimônia para Salvador/);
  assert.ok(send.reply.includes(table));
});
test('não tenta selecionar formação antes da localização e entende solicitação de tabela', () => {
  assert.equal(customerQuoteStage({ city: 'Feira de Santana', locationConfirmed: false }), null);
  assert.equal(isFullTableRequest('Quero a tabela completa'), true);
  assert.equal(isFullTableRequest('Pode mandar todos os valores?'), true);
});

test('preserva conversa espontânea do modelo sem tabela disparada do nada', () => {
  const text = 'Ah, agora entendi! A Ribeira fica em Salvador. Você prefere Duo ou quer ver todas as opções?';
  assert.equal(naturalQuoteReply({ aiText: text, city: 'Salvador', table: 'Duo – R$ 1400' }), text);
});
test('descarta vazamento técnico e não encerra uma negociação de orçamento', () => {
  const r = naturalQuoteReply({ aiText: 'Não temos tabela automática no nosso sistema. Posso ajudar com mais alguma coisa?',
    city: 'Salvador', table: 'Duo – R$ 1400' });
  assert.doesNotMatch(r, /tabela automática|sistema|Posso ajudar com mais alguma coisa/i);
  assert.match(r, /prefere.*tabela/i);
});
test('a tabela aprovada acompanha introdução contextual do modelo, sem alterar preços', () => {
  const quoteTable = 'Duo – R$ 1400\nTrio – R$ 2000';
  const r = naturalQuoteReply({ aiText: 'Claro, já separei as opções para Salvador! Dá uma olhada:',
    city: 'Salvador', table: quoteTable, wantsTable: true });
  assert.match(r, /Claro, já separei/);
  assert.ok(r.endsWith(quoteTable));
});
