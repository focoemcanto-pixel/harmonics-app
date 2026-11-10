import test from 'node:test';
import assert from 'node:assert/strict';
import { formationIntent, formationOptionsReply, containsInternalLeak, guardCommercialReply } from '../lib/ai/commercial/formation-dialogue.mjs';

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

test('bloqueia vazamento exato: tabela oficial cadastrada aqui no sistema', () => {
  const original = 'Feira de Santana não tem tabela oficial cadastrada aqui no sistema, então a equipe vai confirmar os valores para você, tá bom? Enquanto isso, posso ajudar a escolher a formação?';
  assert.equal(containsInternalLeak(original), true);
  const reply = guardCommercialReply({ reply: original, city: 'Feira de Santana', latestCustomer: 'Fica em Feira de Santana', pricingPending: true });
  assert.doesNotMatch(reply, /tabela|sistema|cadastrad|equipe vai/i);
  assert.match(reply, /conferir os valores/);
});

test('se cliente aceita ajuda para escolher formação, mostra as cinco opções imediatamente', () => {
  const previousAssistant = 'Enquanto isso, posso ajudar a escolher a formação que vocês preferem para a cerimônia?';
  assert.equal(formationIntent('ok', previousAssistant), 'show_options');
  const reply = guardCommercialReply({ reply: 'Que legal! Já sabem quais instrumentos desejam?',
    city: 'Feira de Santana', latestCustomer: 'ok', previousAssistant, pricingPending: true });
  assert.match(reply, /Duo/);
  assert.match(reply, /Sexteto/);
  assert.doesNotMatch(reply, /tabela.*cadastrad|equipe vai/i);
});

test('preserva resposta comercial genuína e conversa fora da pendência', () => {
  const original = 'O trio com voz, violino e piano fica muito bonito na cerimônia!';
  assert.equal(guardCommercialReply({ reply: original, city: 'Salvador', latestCustomer: 'gosto de violino', pricingPending: true }), original);
  assert.equal(guardCommercialReply({ reply: original, city: '', latestCustomer: 'gosto de violino', pricingPending: true }), original);
});
