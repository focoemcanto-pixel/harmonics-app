import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateReceptionMusicianCosts as cost } from '../../lib/quotes/reception-personnel.mjs';

test('continuing musician pays only hourly incremental cost', () => {
  for (const h of [1,2,3]) assert.equal(cost({ceremonyIds:['a'],receptionIds:['a'],hours:h}).totalInternalCost, h*100);
});
test('new reception-only musician gets event base plus extra hours', () => {
  for (const [h, expected] of [[1,350],[2,450],[3,550]]) assert.equal(cost({ceremonyIds:['a'],receptionIds:['b'],hours:h}).totalInternalCost, expected);
});
test('Casa Rio: singer continues, guitar and cajon are new professionals', () => {
  const r=cost({ceremonyIds:['singer','keyboard','violin'],receptionIds:['singer','guitar','cajon'],hours:2});
  assert.equal(r.totalInternalCost,1100);
  assert.deepEqual(r.details.map(x=>x.status),['continuing','reception_only','reception_only']);
  assert.equal(r.requiresClientPriceRule,true);
});
test('instrument changes do not change the same musician identity', () => {
  const r=cost({ceremonyIds:['singer','multi','violin'],receptionIds:['singer','multi','cajon'],hours:2});
  assert.equal(r.totalInternalCost,850);
});
test('unknown, duplicate or invalid inputs never produce a cost', () => {
  assert.equal(cost({ceremonyIds:['a'],receptionIds:[''],hours:2}).ok,false);
  assert.equal(cost({ceremonyIds:['a'],receptionIds:['a','a'],hours:2}).ok,false);
  assert.equal(cost({ceremonyIds:['a'],receptionIds:['b'],hours:0}).ok,false);
});
