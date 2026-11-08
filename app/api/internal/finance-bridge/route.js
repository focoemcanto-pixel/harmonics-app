import {NextResponse} from 'next/server';
import {getSupabaseAdmin} from '@/lib/supabase-admin';
import {verifyBridgeRequest} from '@/lib/finance-bridge/auth.mjs';
import {enrichBridgeReceivables} from '@/lib/finance-bridge/receivables-enrichment.mjs';
export const dynamic='force-dynamic';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const NO_STORE={'Cache-Control':'no-store'};
const json=(data,status=200)=>NextResponse.json(data,{status,headers:NO_STORE});
function config(){
 const secret=process.env.FOCO_FINANCE_BRIDGE_SECRET;
 const workspace=process.env.HARMONICS_FINANCE_BRIDGE_WORKSPACE_ID;
 const actor=process.env.HARMONICS_FINANCE_BRIDGE_ACTOR_ID;
 if(!secret||secret.length<32||!UUID.test(workspace||'')||!UUID.test(actor||''))
  throw Object.assign(new Error('Bridge not provisioned'),{status:503});
 return {secret,workspace,actor};
}
async function signed(request,raw){
 const env=config();
 if(!await verifyBridgeRequest(request,raw,env.secret))
  throw Object.assign(new Error('Unauthorized bridge request'),{status:401});
 return env;
}
export async function GET(request){
 try{
  if(new URL(request.url).search)return json({error:'No query parameters allowed'},400);
  const env=await signed(request,'');
  const {data,error}=await getSupabaseAdmin().from('op_finance_bridge_outbox')
    .select('ledger_id,event_id,kind,amount_cents,occurred_on,reverses_id,created_at')
    .eq('workspace_id',env.workspace).is('acknowledged_at',null)
    .order('created_at').limit(100);
  if(error)throw error;
  return json({ok:true,workspace:env.workspace,items:data||[]});
 }catch(e){return json({ok:false,error:e.status===401?'unauthorized':'bridge_unavailable'},e.status||503);}
}
export async function POST(request){
 let raw='';
 try{
  if(new URL(request.url).search)return json({error:'No query parameters allowed'},400);
  raw=await request.text();
  if(raw.length>8192)return json({error:'payload_too_large'},413);
  const env=await signed(request,raw);
  let body;
  try{body=JSON.parse(raw)}catch{return json({error:'invalid_json'},400);}
  const db=getSupabaseAdmin();
  if(body?.action==='receivables'){
   const {data,error}=await db.rpc('op_finance_bridge_receivables',{p_workspace:env.workspace});
   if(error)throw error;
   const ids=(data||[]).map(e=>e.event_id).filter(id=>UUID.test(String(id)));
   if(!ids.length)return json({ok:true,workspace:env.workspace,generated_at:new Date().toISOString(),events:[]});
   // All three reads are scoped to the authenticated workspace. No financial data is changed.
   const [events,sheets,ledger]=await Promise.all([
    db.from('events').select('id,event_date,musician_cost,sound_cost,extra_transport_cost,other_cost,is_demo')
     .eq('workspace_id',env.workspace).in('id',ids),
    db.from('op_finance_events').select('event_id,status,costs').eq('workspace_id',env.workspace).in('event_id',ids),
    db.from('op_finance_ledger').select('id,event_id,cost_id,kind,amount_cents,reverses_id')
     .eq('workspace_id',env.workspace).in('event_id',ids).in('kind',['payment','reversal'])
   ]);
   if(events.error||sheets.error||ledger.error)throw new Error('Cost snapshot unavailable');
   const enriched=enrichBridgeReceivables(data||[],events.data||[],sheets.data||[],ledger.data||[]);
   return json({ok:true,workspace:env.workspace,generated_at:new Date().toISOString(),events:enriched});
  }
  if(body?.action==='lookup'){
   if(!UUID.test(body.event_id||''))return json({error:'invalid_event'},400);
   const {data:event,error:eventError}=await db.from('events')
     .select('id,workspace_id,client_name,event_date,status,agreed_amount')
     .eq('workspace_id',env.workspace).eq('id',body.event_id).maybeSingle();
   if(eventError)throw eventError;
   if(!event)return json({error:'event_not_found'},404);
   const {data:sheet,error:sheetError}=await db.from('op_finance_events')
     .select('contract_cents,status').eq('workspace_id',env.workspace)
     .eq('event_id',event.id).maybeSingle();
   if(sheetError)throw sheetError;
   return json({ok:true,event:{id:event.id,client_name:event.client_name,
     event_date:event.event_date,status:event.status,
     contract_cents:sheet?.contract_cents??Math.round(Number(event.agreed_amount||0)*100),
     sheet_status:sheet?.status||'unchecked'}});
  }
  if(body?.action==='receipt'){
   const valid=UUID.test(body.payment_key||'')&&UUID.test(body.event_id||'')
      &&Number.isSafeInteger(body.amount_cents)&&body.amount_cents>0
      &&body.amount_cents<=100000000000&&DATE.test(body.occurred_on||'')
      &&(body.hub_transaction_id==null||(Number.isSafeInteger(body.hub_transaction_id)&&body.hub_transaction_id>0))
      &&(body.in_opening==null||typeof body.in_opening==='boolean');
   if(!valid)return json({error:'invalid_receipt'},400);
   const {data,error}=await db.rpc('op_finance_bridge_receive',{
     p_workspace:env.workspace,p_actor:env.actor,p_payment_key:body.payment_key,
     p_event:body.event_id,p_amount_cents:body.amount_cents,
     p_occurred_on:body.occurred_on,p_hub_transaction_id:body.hub_transaction_id??null,
     p_in_opening:body.in_opening??null
   });
   if(error)return json({error:'receipt_rejected',detail:error.message},409);
   return json({ok:true,...data});
  }
  if(body?.action==='ack'){
   if(!UUID.test(body.ledger_id||'')||typeof body.hub_receipt_ref!=='string'
      ||! /^[A-Za-z0-9:._-]{1,128}$/.test(body.hub_receipt_ref))return json({error:'invalid_ack'},400);
   const table=db.from('op_finance_bridge_outbox');
   const {data:old,error:readError}=await table.select('ledger_id,hub_receipt_ref,acknowledged_at')
     .eq('workspace_id',env.workspace).eq('ledger_id',body.ledger_id).maybeSingle();
   if(readError)throw readError;
   if(!old)return json({error:'message_not_found'},404);
   if(old.acknowledged_at)return old.hub_receipt_ref===body.hub_receipt_ref
     ?json({ok:true,duplicate:true}):json({error:'ack_conflict'},409);
   const {data,error}=await db.from('op_finance_bridge_outbox')
     .update({acknowledged_at:new Date().toISOString(),hub_receipt_ref:body.hub_receipt_ref})
     .eq('workspace_id',env.workspace).eq('ledger_id',body.ledger_id)
     .is('acknowledged_at',null).select('ledger_id');
   if(error)throw error;
   if(data?.length)return json({ok:true,duplicate:false});
   const again=await db.from('op_finance_bridge_outbox').select('hub_receipt_ref')
     .eq('workspace_id',env.workspace).eq('ledger_id',body.ledger_id).single();
   return again.data?.hub_receipt_ref===body.hub_receipt_ref
     ?json({ok:true,duplicate:true}):json({error:'ack_conflict'},409);
  }
  return json({error:'unsupported_action'},400);
 }catch(e){return json({ok:false,error:e.status===401?'unauthorized':'bridge_unavailable'},e.status||503);}
}
