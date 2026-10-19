import test from 'node:test';
import assert from 'node:assert/strict';
import { financeDecision } from '../lib/operational-finance/model.mjs';
const settings = { opening_on: '2026-10-01', opening_cents: 900000 };
const event = (id, date) => ({ id, event_date: date, client_name: id });
const sheet = (id, contract, amount) => ({ event_id: id, status: 'checked', contract_cents: contract, costs: [{ id: `${id}-cost`, amount_cents: amount, category: 'musician' }] });
const events = [event('dec', '2026-12-20')];
const sheets = [sheet('dec', 1000000, 600000)];
const prepaid = [{ id: 'r', event_id: 'dec', kind: 'receipt', amount_cents: 1000000, occurred_on: '2026-09-20', in_opening: true }];
const run = (ledger = prepaid, initial = settings) => financeDecision(events, sheets, ledger, initial, '2026-10-19');
test('lucro por competência permanece separado do fluxo do evento quitado antecipadamente', () => {
 const d = run(), dec = d.months.find(r => r.month === '2026-12');
 assert.deepEqual([dec.contract, dec.received, dec.open, dec.result, dec.marginPercent], [1000000,1000000,0,400000,40]);
 assert.deepEqual([dec.receivable, dec.commitments, dec.coverage, dec.need], [0,600000,-600000,600000]);
 assert.deepEqual([d.cash,d.projected,d.reserve,d.free], [900000,300000,600000,300000]);
});
test('retiradas reduzem o livre e causam alerta sem alterar lucro', () => {
 const withdrawal = amount => [...prepaid, {id:'w',kind:'withdrawal',amount_cents:amount,occurred_on:'2026-10-19'}];
 assert.equal(run(withdrawal(200000)).free,100000);
 const d=run(withdrawal(350000));assert.equal(d.free,-50000);assert.equal(d.deficit,50000);
 assert.equal(d.months.find(r=>r.month==='2026-12').result,400000);
});
test('excedente anterior financia dezembro; não soma déficits isolados', () => {
 const d=financeDecision([...events,event('nov','2026-11-20')],[...sheets,sheet('nov',1000000,100000)],prepaid,{...settings,opening_cents:0},'2026-10-19');
 assert.equal(d.reserve,0);assert.equal(d.projected,300000);
 const nov=d.months.find(r=>r.month==='2026-11');assert.deepEqual([nov.projected,nov.reserve,nov.free],[900000,600000,300000]);
});
test('déficit dentro do mesmo mês não desaparece com entrada posterior', () => {
 const d=financeDecision([event('cost','2026-11-01'),event('income','2026-11-25')],[sheet('cost',0,600000),sheet('income',900000,0)],[],{...settings,opening_cents:0},'2026-10-19');
 assert.equal(d.reserve,600000);assert.equal(d.deficit,600000);assert.equal(d.projected,300000);
});
test('parcial, pagamento manual e estorno não contam novamente', () => {
 const ledger=[{id:'r',event_id:'dec',kind:'receipt',amount_cents:400000,occurred_on:'2026-10-10'}, {id:'p',event_id:'dec',cost_id:'dec-cost',kind:'payment',amount_cents:100000,occurred_on:'2026-10-10'}];
 let d=run(ledger);let dec=d.months.find(r=>r.month==='2026-12');
 assert.deepEqual([dec.open,dec.pending,dec.realized,dec.coverage],[600000,500000,100000,100000]);
 d=run([...ledger,{id:'s',kind:'reversal',reverses_id:'r',occurred_on:'2026-10-11'}]);
 assert.equal(d.months.find(r=>r.month==='2026-12').open,1000000);
});
test('recebimento sem data vigente é incerto e não financia saída datada', () => {
 const d=financeDecision([event('past','2026-09-10'),...events],[sheet('past',900000,0),...sheets],prepaid,settings,'2026-10-19');
 assert.equal(d.uncertainReceivable,900000);assert.equal(d.reserve,600000);assert.equal(d.projected,300000);
});
test('evento realizado sai dos pendentes sem dupla dedução de custo', () => {
 const d=financeDecision(events,sheets,prepaid,settings,'2026-12-21');
 assert.equal(d.cash,300000);assert.equal(d.reserve,0);assert.equal(d.projected,300000);
 const dec=d.months.find(r=>r.month==='2026-12');assert.deepEqual([dec.realized,dec.pending],[600000,0]);
});
