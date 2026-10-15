import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { renderTemplate } = await import('../lib/automation/render-template.js');

const sql = readFileSync(new URL('../docs/sql/2026-10-15-repertoire-reminder-template.sql', import.meta.url), 'utf8');
const body = sql.match(/'(Olá, \{cliente_nome\}![^']*)'/)?.[1];

test('template do lembrete de repertório renderiza o mesmo texto do fallback antigo', () => {
  assert.ok(body, 'corpo do template encontrado no SQL');
  const context = {
    '{cliente_nome}': 'Ana', cliente_nome: 'Ana',
    '{evento_data}': '30/10/2026', evento_data: '30/10/2026',
    '{link_painel_cliente}': 'https://app.bandaharmonics.com/cliente/tok', link_painel_cliente: 'https://app.bandaharmonics.com/cliente/tok',
  };
  // Mesma construção de resolveMessage() em execute-automation-event.js para repertoire_pending_15_days_client.
  const fallback =
    `Olá, ${context['{cliente_nome}']}! Faltam 15 dias para o seu evento (${context['{evento_data}']}). ` +
    `Por favor, acesse o painel e finalize a escolha do repertório: ${context['{link_painel_cliente}']}`;
  assert.equal(renderTemplate(body, context), fallback);
});
