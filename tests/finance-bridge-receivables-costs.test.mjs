import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enrichBridgeReceivables} from '../lib/finance-bridge/receivables-enrichment.mjs';
const base=[{event_id:'event-a',event_date:'2026-12-12',contract_cents:300000,receipts:[{ledger_id:'r1',amount_cents:100000}],parcels:[]}];
test('checked operational costs beat stale event costs and do not alter gross receipts',()=>{
 const actual=enrichBridgeReceivables(base,[{id:'event-a',event_date:'2026-12-12',musician_cost:1800,sound_cost:500}],
 [{event_id:'event-a',status:'checked',costs:[{id:'mus1',category:'musician',description:'Tecladista',amount_cents:75000},{id:'marcos',category:'musician',amount_cents:0},{id:'som',category:'sound',amount_cents:30000,due_on:'2026-12-10'}]}],
 [{id:'pay1',event_id:'event-a',cost_id:'mus1',kind:'payment',amount_cents:50000}]);
 assert.equal(actual[0].contract_cents,300000);
 assert.deepEqual(actual[0].receipts,base[0].receipts);
 assert.equal(actual[0].cost_source,'operational_checked');
 assert.equal(actual[0].cost_total_cents,105000);
 assert.equal(actual[0].cost_open_cents,55000);
 assert.equal(actual[0].projected_margin_cents,195000);
 assert.equal(actual[0].costs.some(x=>x.id==='marcos'),false);
 assert.equal(actual[0].costs[1].due_on,'2026-12-10');
});
test('reversed cost payment is not deducted twice',()=>{
 const snapshot=enrichBridgeReceivables(base,[{id:'event-a',event_date:'2026-12-12'}],
 [{event_id:'event-a',status:'checked',costs:[{id:'mus1',amount_cents:75000}]}],
 [{id:'pay1',event_id:'event-a',cost_id:'mus1',kind:'payment',amount_cents:50000},{kind:'reversal',reverses_id:'pay1'}]);
 assert.equal(snapshot[0].cost_open_cents,75000);
});
test('unchecked event uses explicitly marked legacy estimate, never calls it checked',()=>{
 const snapshot=enrichBridgeReceivables(base,[{id:'event-a',event_date:'2026-12-12',musician_cost:700,sound_cost:250,profit_amount:2050}],[],[]);
 assert.equal(snapshot[0].cost_source,'legacy_estimate');
 assert.equal(snapshot[0].costs_complete,false);
 assert.equal(snapshot[0].cost_total_cents,95000);
 assert.equal(snapshot[0].projected_margin_cents,205000);
});
test('unavailable cost data remains flagged incomplete and never becomes verified profit',()=>{
 const snapshot=enrichBridgeReceivables(base,[],[],[]);
 assert.equal(snapshot[0].cost_source,'unavailable');
 assert.equal(snapshot[0].costs_complete,false);
 assert.deepEqual(snapshot[0].costs,[]);
});
