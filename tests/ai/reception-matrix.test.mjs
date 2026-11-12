import test from 'node:test';
import assert from 'node:assert/strict';
import { receptionMatrix } from '../../lib/ai/commercial/reception-matrix.mjs';

const formations = ['Duo','Trio','Quarteto','Quinteto','Sexteto'];
function rules() {
  return formations.flatMap((formation,i) => [1,2,3].map(hours => ({
    category: 'reception',
    item_key: `${formation.toLowerCase()}_${hours}h`,
    amount: (i+1)*100 + hours*25,
    valid_from: '2000-01-01',
  })));
}
const area = [{ name:'Cidade Sintética', active: true, status:'served', price_tier:'base', travel_fee:0 }];

test('five independent reception formations x three durations use exact official rules', () => {
  const result = receptionMatrix({
    date:'2099-12-11', location:'Cidade Sintética', rules:rules(), areas:area,
  });
  assert.equal(result.ok,true);
  assert.equal(result.rows.length,5);
  assert.deepEqual(result.rows[0],{ formation:'Duo', prices:[125,150,175] });
  assert.deepEqual(result.rows[1],{ formation:'Trio', prices:[225,250,275] });
  assert.match(result.text,/Receptivo após a cerimônia/);
  assert.match(result.text,/O valor do receptivo é SOMADO ao valor da formação da cerimônia/);
  assert.match(result.text,/formação do receptivo pode ser diferente/);
  assert.doesNotMatch(result.text,/cerimônia — duo|Duo para cerimônia/i);
});

test('missing region does not quote a base rate or invent fees', () => {
  assert.equal(receptionMatrix({ rules:rules() }).ok,false);
  const unknown = receptionMatrix({location:'Cidade Não Atendida',rules:rules(),areas:area});
  assert.equal(unknown.ok,false);
  assert.equal(unknown.text,undefined);
});

test('regional tier never inherits base reception prices', () => {
  const tier = [{name:'Cidade Especial',active:true,status:'served',price_tier:'exclusive',travel_fee:0}];
  const withoutTier = receptionMatrix({location:'Cidade Especial',rules:rules(),areas:tier});
  assert.equal(withoutTier.ok,false);
  const regional = rules().map(x=>({...x,item_key:`${x.item_key}@exclusive`,amount:x.amount+1000}));
  const withTier = receptionMatrix({location:'Cidade Especial',rules:[...rules(),...regional],areas:tier});
  assert.equal(withTier.ok,true);
  assert.equal(withTier.rows[0].prices[0],1125);
});

test('blank date is only an indicative table and does not block intake', () => {
  const result=receptionMatrix({ location:'Cidade Sintética',rules:rules(),areas:area});
  assert.equal(result.ok,true);
  assert.match(result.text,/1h R\$ 125,00/);
});
