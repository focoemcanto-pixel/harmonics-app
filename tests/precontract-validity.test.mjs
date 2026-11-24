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
  assert.equal(renewed.expires_at,'2035-03-25T12:00:00.000Z', 'renovação: 15 dias (Manual §15)');
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

test('Manual §15: 15 dias explícitos para novos envios; legado sem expires_at mantém 7 dias', async () => {
  const { buildPrecontractExpiresAt, getPrecontractExpirationDays, getLegacyPrecontractExpirationDays } = await import('../lib/contracts/precontract-expiration.js');
  assert.equal(getPrecontractExpirationDays(), 15);
  assert.equal(getLegacyPrecontractExpirationDays(), 7);
  assert.equal(buildPrecontractExpiresAt(new Date('2035-03-10T12:00:00Z')), '2035-03-25T12:00:00.000Z');
  assert.equal(getPrecontractExpirationDate(old).toISOString(), '2035-01-08T12:00:00.000Z', 'registro antigo não é estendido');
  const explicit = { ...old, expires_at: '2035-02-01T00:00:00.000Z' };
  assert.equal(getPrecontractExpirationDate(explicit).toISOString(), '2035-02-01T00:00:00.000Z', 'expires_at existente é preservado');
  const prev = process.env.PRECONTRACT_EXPIRATION_DAYS;
  process.env.PRECONTRACT_EXPIRATION_DAYS = '10';
  try {
    assert.equal(getPrecontractExpirationDays(), 10);
    assert.equal(getLegacyPrecontractExpirationDays(), 10, 'variável de ambiente continua mandando');
  } finally {
    if (prev === undefined) delete process.env.PRECONTRACT_EXPIRATION_DAYS; else process.env.PRECONTRACT_EXPIRATION_DAYS = prev;
  }
});


test('precontract save accepts nullable legacy fields projected from structured services', async () => {
  const { readFile } = await import('node:fs/promises');
  const { legacyServiceProjection } = await import('../lib/contracts/service-specs.mjs');
  // Exercise the actual client payload without mounting the Next.js admin page.
  const source = await readFile(new URL('../app/(admin)/pre-contratos/PreContratosClient.js', import.meta.url), 'utf8');
  const save = source.slice(source.indexOf('async function salvarPreContrato()'));
  const match = save.match(/const payload = \{[\s\S]*?\n      \};/);
  assert.ok(match, 'save payload must be present');
  const buildPayload = new Function('form', 'searchParams', 'financeiro', 'statusToSave',
    'cleanPhone', 'normalizeTimeStrict', 'normalizeFormation', match[0] + '\nreturn payload;');
  const base = {
    client_name: ' Ana ', client_email: '', client_phone: '',
    location_name: ' Local ', location_address: '', notes: '',
    event_date: '2035-12-01', duration_min: 60,
  };
  const primary = { kind: 'primary', formation: 'Duo', roles: ['Piano'], duration_minutes: 60 };
  const reception = { kind: 'reception', formation: 'Trio', roles: ['Voz'], duration_minutes: 120 };
  const scenarios = [
    { specs: [primary], fields: {} },
    { specs: [], fields: {} },
    { specs: [primary, { ...reception, roles: [] }], fields: {} },
    { specs: [primary, reception], fields: {} },
    { specs: [primary], fields: { client_name: null, client_email: null, location_name: null, location_address: null, notes: null }, guide: true },
  ];
  for (const { specs, fields, guide } of scenarios) {
    const form = { ...base, ...legacyServiceProjection(specs), ...fields, service_specs: specs };
    const payload = buildPayload(form, { get: () => guide ? 'precontract' : null }, {}, 'link_generated',
      value => String(value ?? '').replace(/\D/g, ''), value => value ?? '', value => String(value ?? ''));
    assert.equal(payload.client_name, String(form.client_name ?? '').trim() || null);
    assert.equal(payload.location_name, String(form.location_name ?? '').trim() || null);
    assert.equal(payload.location_address, null);
    assert.equal(payload.client_email, null);
    assert.equal(payload.notes, null);
    assert.equal(payload.instruments, form.instruments || null);
    assert.equal(payload.reception_formation, form.reception_hours > 0 ? form.reception_formation || '' : '');
    assert.equal(payload.reception_instruments, form.reception_hours > 0 ? form.reception_instruments || '' : '');
    assert.equal(payload.service_specs, specs);
    if (guide) assert.equal(payload.metadata.location_name, null);
  }
});
