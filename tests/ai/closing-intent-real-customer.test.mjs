import test from 'node:test';
import assert from 'node:assert/strict';
import { isDirectClosingRequest } from '../../lib/ai/agent/conversation-turn.mjs';

test('real customer polite closing intent is recognized', () => {
  for (const phrase of ['Gostaria de fechar com vcs. Gostaria do Trio', 'Gostaria de fechar com vocês', 'Queria fechar com vocês', 'Quero fechar', 'Vamos fechar']) {
    assert.equal(isDirectClosingRequest(phrase), true, phrase);
  }
});

test('formation selection alone is not a closing instruction', () => {
  for (const phrase of ['Gostaria do Trio', 'Qual o preço do Trio?', 'Apenas serviço musical']) {
    assert.equal(isDirectClosingRequest(phrase), false, phrase);
  }
});
