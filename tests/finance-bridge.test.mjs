import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bridgeSignature,verifyBridgeRequest} from '../lib/finance-bridge/auth.mjs';
const secret='synthetic-32-characters-secret-for-bridge-test';
const url='https://fixture.invalid/api/internal/finance-bridge';
async function signed(body='',method='POST',timestamp=1700000000,at=timestamp*1000){
 const sig=await bridgeSignature(secret,method,'/api/internal/finance-bridge',timestamp,body);
 const req=new Request(url,{method,headers:{
   'x-foco-finance-timestamp':String(timestamp),
   'x-foco-finance-signature':'sha256='+sig
 },...(method==='POST'?{body}:{})});
 return {req,at};
}
test('valid signed request is accepted, without a production secret',async()=>{
 const {req,at}=await signed('{"action":"receipt"}');
 assert.equal(await verifyBridgeRequest(req,'{"action":"receipt"}',secret,at),true);
});
test('tampered payload, method or path never authorizes a write',async()=>{
 const {req,at}=await signed('{"amount_cents":80000}');
 assert.equal(await verifyBridgeRequest(req,'{"amount_cents":90000}',secret,at),false);
 const moved=new Request('https://fixture.invalid/api/elsewhere',{method:'POST',headers:req.headers});
 assert.equal(await verifyBridgeRequest(moved,'{"amount_cents":80000}',secret,at),false);
});
test('expired, future, malformed and missing signatures fail closed',async()=>{
 const {req,at}=await signed('{}');
 assert.equal(await verifyBridgeRequest(req,'{}',secret,at+301000),false);
 assert.equal(await verifyBridgeRequest(req,'{}',secret,at-301000),false);
 assert.equal(await verifyBridgeRequest(new Request(url,{method:'POST'}),'{}',secret,at),false);
 assert.equal(await verifyBridgeRequest(req,'{}','short',at),false);
});
test('server signs query string, preventing a query-parameter replay',async()=>{
 const {req,at}=await signed('','GET');
 const moved=new Request(url+'?workspace=other',{headers:req.headers});
 assert.equal(await verifyBridgeRequest(moved,'',secret,at),false);
});
