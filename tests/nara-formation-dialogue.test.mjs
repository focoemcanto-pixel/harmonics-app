import test from 'node:test';
import assert from 'node:assert/strict';
import { formationIntent, formationOptionsReply, containsInternalLeak } from '../lib/ai/commercial/formation-dialogue.mjs';

test('aceite "ok" após oferta de formações entrega as opções sem nova oferta', () => {
  assert.equal(formationIntent('ok', 'Posso te apresentar as formações da banda, de Duo a Sexteto.'), 'show_options');
  assert.equal(formationIntent('sim', 'Quer que eu mostre as opções de formações?'), 'show_options');
  assert.equal(formationIntent('ok', 'Oi, sou a Nara! Em qual cidade?'), null);
});
test('pedido explícito das opções é atendido mesmo sem resposta anterior', () => {
  assert.equal(formationIntent('me mostre as opções', ''), 'show_options');
  assert.equal(formationIntent('Quais as formações?', ''), 'show_options');
});
test('opções informam instrumentos sem inventar preço nem repetir pendência administrativa', () => {
  const text = formationOptionsReply({ city: 'Feira de Santana' });
  for(const name of ['Duo','Trio','Quarteto','Quinteto','Sexteto']) assert.match(text,new RegExp(name));
  assert.match(text, /voz e piano/);
  assert.match(text, /Qual dessas combina/);
  assert.doesNotMatch(text, /R\\$|equipe|confirmar valores|tabela autom[aá]tica|posso te apresentar/i);
});
test('não expõe funcionamento interno', () => {
  assert.equal(containsInternalLeak('Não está na nossa base de dados'), true);
  assert.equal(containsInternalLeak('Nosso sistema interno não tem tabela automática'), true);
  assert.equal(containsInternalLeak('Claro! Aqui estão as formações para cerimônia.'), false);
});
