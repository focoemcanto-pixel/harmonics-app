import test from 'node:test';
import assert from 'node:assert/strict';
import { financeDecision, monthlyCommitments } from '../lib/operational-finance/model.mjs';
import { readingContext } from '../lib/operational-finance/reading.mjs';

// Entirely synthetic scenario. Never replace these fixtures with production records.
const events = [
  { id: 'synthetic-alpha', client_name: 'Cliente Alfa', event_date: '2042-03-18' },
  { id: 'synthetic-beta', client_name: 'Cliente Beta', event_date: '2042-04-04' },
  { id: 'synthetic-gamma', client_name: 'Cliente Gama', event_date: '2042-04-22' },
  { id: 'synthetic-delta', client_name: 'Cliente Delta', event_date: '2042-05-24' },
];
const sheets = [
  { event_id: 'synthetic-alpha', status: 'checked', contract_cents: 243719, expected_receipt_on: '2042-03-16', costs: [] },
  { event_id: 'synthetic-beta', status: 'checked', contract_cents: 157391, expected_receipt_on: '2042-03-27', costs: [
    { id: 'synthetic-cost-a', category: 'musician', description: 'Custo sintético A', amount_cents: 41837 },
    { id: 'synthetic-cost-b', category: 'outros', description: 'Custo sintético B', amount_cents: 27643 },
  ] },
  { event_id: 'synthetic-gamma', status: 'checked', contract_cents: 463927, expected_receipt_on: '2042-04-17', costs: [] },
  { event_id: 'synthetic-delta', status: 'checked', contract_cents: 219853, costs: [
    { id: 'synthetic-cost-c', category: 'musician', description: 'Custo sintético C', amount_cents: 58429 },
  ] },
];
const ledger = [
  { id: 'synthetic-receipt-a', event_id: 'synthetic-beta', kind: 'receipt', amount_cents: 81379, occurred_on: '2042-03-07', in_opening: true },
  { id: 'synthetic-receipt-b', event_id: 'synthetic-delta', kind: 'receipt', amount_cents: 219853, occurred_on: '2042-03-07', in_opening: true },
];
const date = '2042-03-09';
const settings = { opening_on: '2042-03-02', opening_cents: 187463 };
const decision = financeDecision(events, sheets, ledger, settings, date);
const planning = monthlyCommitments(events, sheets, ledger, date);

test('reserva cronológica sintética identifica custos anteriores à próxima entrada', () => {
  const context = readingContext(decision, planning, events, '2042-03');
  assert.equal(context.operation.reserve, 69480);
  assert.equal(context.critical.on, '2042-04-04');
  assert.equal(context.nextReceipt.due_on, '2042-04-17');
  assert.deepEqual(context.reserveMovements.filter(row => row.direction === 'out').map(row => [row.description, row.amount]), [
    ['Custo sintético A', 41837], ['Custo sintético B', 27643],
  ]);
});

test('recebimento sintético antecipado tem competência distinta do fluxo', () => {
  const context = readingContext(decision, planning, events, '2042-03');
  assert.equal(context.operation.open, 243719);
  assert.equal(context.operation.receivable, 319731);
  assert.deepEqual(context.crossingReceipts.map(row => [row.event_id, row.amount, row.due_on, row.event_date]), [
    ['synthetic-beta', 76012, '2042-03-27', '2042-04-04'],
  ]);
  const nextMonth = readingContext(decision, planning, events, '2042-04');
  assert.equal(nextMonth.outsideReceipts[0].event.id, 'synthetic-beta');
});

test('fixture sintético de evento futuro quitado mantém operação e custos pendentes', () => {
  const context = readingContext(decision, planning, events, '2042-05');
  assert.deepEqual([
    context.operation.received, context.operation.receivable,
    context.operation.pending, context.operation.result,
  ], [219853, 0, 58429, 161424]);
});

test('seletores preservam a imutabilidade do cenário inteiramente sintético', () => {
  const original = JSON.stringify({ decision, planning, events, sheets, ledger });
  for (const month of ['2042-03', '2042-04', '2042-05', '2042-06']) {
    readingContext(decision, planning, events, month);
  }
  assert.equal(JSON.stringify({ decision, planning, events, sheets, ledger }), original);
});

test('déficit cronológico é detectado com retirada de valor fictício', () => {
  const next = financeDecision(events, sheets, [...ledger, {
    id: 'synthetic-withdrawal', kind: 'withdrawal', amount_cents: 987653, occurred_on: date,
  }], settings, date);
  const context = readingContext(next, planning, events, '2042-03');
  assert.ok(context.operation.free < 0);
  assert.ok(context.risk.balance < 0);
});

test('evento sintético sem data mantém fluxo previsto sem inventar competência e renderiza a leitura', async () => {
  const undated = { id: 'synthetic-undated', client_name: 'Cliente Sem Data Sintético', event_date: null };
  const syntheticEvents = [undated];
  const syntheticSheets = [{ event_id: undated.id, status: 'checked', contract_cents: 32741, expected_receipt_on: '2047-09-13', costs: [] }];
  const syntheticSettings = { opening_on: '2047-07-06', opening_cents: 89213 };
  const syntheticDate = '2047-07-08';
  const original = JSON.stringify({ syntheticEvents, syntheticSheets, syntheticSettings });
  const syntheticPlanning = monthlyCommitments(syntheticEvents, syntheticSheets, [], syntheticDate);
  const syntheticDecision = financeDecision(syntheticEvents, syntheticSheets, [], syntheticSettings, syntheticDate);
  const context = readingContext(syntheticDecision, syntheticPlanning, syntheticEvents, '2047-09');
  assert.deepEqual(context.crossingReceipts.map(row => [row.event_id, row.amount, row.due_on, row.event_date]), [
    [undated.id, 32741, '2047-09-13', null],
  ]);
  assert.equal(context.operation.receivable, 32741);
  assert.equal(context.operation.contract, 0);
  assert.equal(context.operation.result, 0);
  assert.equal(syntheticDecision.future.events, 0);
  assert.ok(syntheticDecision.months.every(row => row.contract === 0 && row.result === 0));
  assert.deepEqual(syntheticDecision.timeline.map(row => [row.on, row.change]), [['2047-09-13', 32741]]);
  assert.equal(readingContext(syntheticDecision, syntheticPlanning, syntheticEvents, '2047-07').crossingReceipts.length, 0);

  // Exercise the actual JSX with Next's compiler; replace only the CSS-module import.
  const { createRequire, default: Module } = await import('node:module');
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname } = await import('node:path');
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const require = createRequire(import.meta.url);
  const { transformSync } = require('next/dist/build/swc');
  const filename = fileURLToPath(new URL('../components/finance/FinancialReading.js', import.meta.url));
  const source = readFileSync(filename, 'utf8')
    .replace('import styles from "./FinancialReading.module.css";', 'const styles = {};')
    .replaceAll('@/lib/', '../../lib/');
  const { code } = transformSync(source, { filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const compiled = new Module(filename);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(dirname(filename));
  compiled._compile(code, filename);
  const html = renderToStaticMarkup(createElement(compiled.exports.default, {
    decision: syntheticDecision, planning: syntheticPlanning, events: syntheticEvents,
    sheets: syntheticSheets, month: '2047-09', setMonth() {}, onEvent() {}, onUnchecked() {},
  }));
  assert.match(html, /Evento sem data definida/);
  assert.match(html, /A competência econômica será definida quando a data do evento for informada/);
  assert.match(html, /Faz parte do caixa de setembro/);
  assert.doesNotMatch(html, /e da operação de setembro/);
  assert.equal(JSON.stringify({ syntheticEvents, syntheticSheets, syntheticSettings }), original);
});

test('ordenação sintética da overview aceita eventos sem data em qualquer posição', async () => {
  const { compareEventDates } = await import('../lib/operational-finance/reading.mjs');
  const undated = { id: 'synthetic-unscheduled', event_date: null };
  const dated = { id: 'synthetic-scheduled', event_date: '2047-09-21' };
  assert.deepEqual([undated, dated].sort(compareEventDates).map(row => row.id), [dated.id, undated.id]);
  assert.deepEqual([dated, undated].sort(compareEventDates).map(row => row.id), [dated.id, undated.id]);
  assert.equal(compareEventDates(undated, { event_date: null }), 0);
});
