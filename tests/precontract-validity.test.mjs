import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrecontractValidityRenewal, getPrecontractExpirationDate, isPrecontractExpiredByAge, expirePrecontractIfNeeded, expireOldPrecontractsForWorkspace } from '../lib/contracts/precontract-expiration.js';
const now = new Date('2035-03-10T12:00:00Z');
const old = { id:'synthetic-pre', status:'draft', created_at:'2035-01-01T12:00:00Z' };
test('renewal uses current time and preserves creation time; legacy age fallback remains', () => {
  assert.equal(getPrecontractExpirationDate(old).toISOString(), '2035-01-08T12:00:00.000Z');
  assert.equal(isPrecontractExpiredByAge(old, now), true);
  const renewed = { ...old, ...buildPrecontractValidityRenewal({ ...old, status:'expired' }, now) };
  assert.equal(renewed.status,'link_generated');
  assert.equal(renewed.created_at,old.created_at);
  assert.equal(renewed.expires_at,'2035-03-17T12:00:00.000Z');
  assert.equal(isPrecontractExpiredByAge(renewed, now),false);
  assert.equal(isPrecontractExpiredByAge(renewed,new Date(renewed.expires_at)),true);
});
test('signed, cancelled and archived contracts cannot be renewed', () => {
  for (const status of ['signed','assinado','cancelled','canceled','archived','arquivado']) {
    assert.throws(() => buildPrecontractValidityRenewal({status},now));
    assert.equal(isPrecontractExpiredByAge({...old,status},now),false);
  }
});
test('renewed legacy records are not expired by public reads or scheduled sweep', async () => {
  const row = {...old,...buildPrecontractValidityRenewal(old, new Date())};
  const calls=[];
  const supabase={from(){const q={select(){return q},or(filter){calls.push(filter);return q},limit(){return q},eq(){return q},then(resolve){return Promise.resolve({data:[row],error:null}).then(resolve)}};return q}};
  assert.equal((await expirePrecontractIfNeeded({supabase,precontract:row})).changed,false);
  assert.deepEqual(await expireOldPrecontractsForWorkspace({supabase}),{expiredCount:0,ids:[]});
  assert.match(calls[0],/expires_at.lte/);
  assert.match(calls[0],/expires_at.is.null,created_at.lt/);
});
test('stale expiry request cannot overwrite a concurrent renewal', async () => {
  const renewed={...old,...buildPrecontractValidityRenewal(old,now)};
  let equality=[];
  const supabase={from(){let writing=false;const q={update(){writing=true;return q},select(){return q},eq(k,v){equality.push([k,v]);return q},is(k,v){equality.push([k,v]);return q},async maybeSingle(){assert.equal(writing,true);return {data:null,error:null}},async single(){return {data:renewed,error:null}}};return q}};
  const result=await expirePrecontractIfNeeded({supabase,precontract:old,now});
  assert.equal(result.changed,false);
  assert.equal(result.expired,false);
  assert.equal(result.precontract.expires_at,renewed.expires_at);
  assert.ok(equality.some(([key])=>key==='expires_at'));
});
