import test from 'node:test';
import assert from 'node:assert/strict';
import { customerQuoteStage, isFullTableRequest } from '../lib/ai/commercial/customer-quote-stage.mjs';

test('um CEP verificado sem tabela aprovada não inventa valores ou encerra atendimento', () => {
  const r = customerQuoteStage({ city: 'Feira de Santana', venue: 'Chácara Beatriz',
    locationConfirmed: true, wantsTable: true, hasOfficialPrices: false });
  assert.equal(r.kind, 'pending_pricing');
  assert.match(r.reply, /Feira de Santana/);
  assert.doesNotMatch(r.reply, /tabela automática|não temos tabela|Posso ajudar com mais alguma coisa|já enviei|equipe vai retornar/i);
  assert.match(r.reply, /Duo, Trio, Quarteto, Quinteto e Sexteto/);
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
  assert.equal(send.reply, table);
});
test('não tenta selecionar formação antes da localização e entende solicitação de tabela', () => {
  assert.equal(customerQuoteStage({ city: 'Feira de Santana', locationConfirmed: false }), null);
  assert.equal(isFullTableRequest('Quero a tabela completa'), true);
  assert.equal(isFullTableRequest('Pode mandar todos os valores?'), true);
});
