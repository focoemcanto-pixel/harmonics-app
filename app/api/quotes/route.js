import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';

function token(){ return Date.now().toString(36)+crypto.randomUUID().replaceAll('-','').slice(0,10); }
function contractLink(request,t){ return new URL('/contrato/'+t,request.url).toString(); }
export async function GET(request){
 const supabase=getSupabaseAdmin();
 try{const auth=await requireWorkspaceAdmin({supabase,request,logPrefix:'[QUOTES]'});if(!auth.ok)return NextResponse.json({ok:false,message:auth.error},{status:auth.status||401});
 const {data,error}=await supabase.from('quotes').select('*').eq('workspace_id',auth.workspaceId).order('created_at',{ascending:false}).limit(100);if(error)throw error;return NextResponse.json({ok:true,data:data||[]});}
 catch(e){return NextResponse.json({ok:false,message:e.message||'Falha ao carregar orçamentos.'},{status:500});}
}
export async function POST(request){
 const supabase=getSupabaseAdmin();
 try{const auth=await requireWorkspaceAdmin({supabase,request,logPrefix:'[QUOTES]'});if(!auth.ok)return NextResponse.json({ok:false,message:auth.error},{status:auth.status||401});
 const b=await request.json(); const payload={...b,workspace_id:auth.workspaceId}; delete payload.id; delete payload.action;
 const {data,error}=await supabase.from('quotes').insert(payload).select('*').single();if(error)throw error;return NextResponse.json({ok:true,data});}
 catch(e){return NextResponse.json({ok:false,message:e.message||'Falha ao salvar orçamento.'},{status:500});}
}
export async function PATCH(request){
 const supabase=getSupabaseAdmin();
 try{const auth=await requireWorkspaceAdmin({supabase,request,logPrefix:'[QUOTES]'});if(!auth.ok)return NextResponse.json({ok:false,message:auth.error},{status:auth.status||401});
 const b=await request.json(); const id=String(b.id||''); if(!id)return NextResponse.json({ok:false,message:'Orçamento inválido.'},{status:400});
 if(b.action==='approve'){
  const {data:q,error:qerr}=await supabase.from('quotes').select('*').eq('id',id).eq('workspace_id',auth.workspaceId).single();if(qerr)throw qerr;
  const missing=[]; if(!q.client_name)missing.push('client_name'); if(!q.client_phone)missing.push('client_phone'); if(!q.event_date)missing.push('event_date'); if(!q.event_time)missing.push('event_time'); if(!q.location_name)missing.push('location_name');
  if(missing.length)return NextResponse.json({ok:false,needsData:true,missing,message:'Complete os dados essenciais antes de criar o pré-contrato.'},{status:422});
  const t=token(),link=contractLink(request,t),agreed=Number(q.agreed_amount||q.suggested_amount||0);
  const pre={workspace_id:auth.workspaceId,client_name:q.client_name,client_email:q.client_email,client_phone:q.client_phone,event_type:q.event_type||'Casamento',event_date:q.event_date,event_time:q.event_time,duration_min:60,location_name:q.location_name,location_address:q.location_address,formation:q.formation,instruments:q.instruments,has_sound:q.has_sound,reception_hours:Number(q.reception_hours||0),has_transport:Number(q.logistics_amount||0)>0,base_amount:q.base_amount,add_reception:q.reception_amount,add_sound:q.sound_amount,add_transport:q.logistics_amount,agreed_amount:agreed,signal_amount:agreed/2,remaining_amount:agreed/2,notes:q.notes,status:'link_generated',public_token:t,generated_link:link};
  const {data:pc,error:perr}=await supabase.from('precontracts').insert(pre).select('*').single();if(perr)throw perr;
  await supabase.from('quotes').update({status:'approved',approved_at:new Date().toISOString(),precontract_id:pc.id,agreed_amount:agreed}).eq('id',id).eq('workspace_id',auth.workspaceId);
  return NextResponse.json({ok:true,data:q,precontract:pc});
 }
 const patch={...b};delete patch.id;delete patch.action;patch.updated_at=new Date().toISOString(); const {data,error}=await supabase.from('quotes').update(patch).eq('id',id).eq('workspace_id',auth.workspaceId).select('*').single();if(error)throw error;return NextResponse.json({ok:true,data});}
 catch(e){return NextResponse.json({ok:false,message:e.message||'Falha ao atualizar orçamento.'},{status:500});}
}