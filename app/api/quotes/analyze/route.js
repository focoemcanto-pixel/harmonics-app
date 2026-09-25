import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireWorkspaceAdmin } from '@/lib/api/require-workspace-access';

const ORIGIN = process.env.HARMONICS_LOGISTICS_ORIGIN || 'Salvador, BA, Brasil';

function money(v){ return Math.round((Number(v)||0)*100)/100; }
function musicianCount(f){ return ({solo:1,duo:2,trio:3,quarteto:4,quinteto:5,sexteto:6,septeto:7})[f]||0; }
function slug(v){ return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function validRule(r,date){ return r.valid_from<=date && (!r.valid_until || r.valid_until>=date); }

async function geocode(query,key){
 const u=new URL('https://maps.googleapis.com/maps/api/geocode/json'); u.searchParams.set('address',query); u.searchParams.set('region','br'); u.searchParams.set('key',key);
 const j=await fetch(u,{cache:'no-store'}).then(r=>r.json()); const x=j.results?.[0]; if(!x) return null;
 return {address:x.formatted_address,lat:x.geometry.location.lat,lng:x.geometry.location.lng,placeId:x.place_id};
}
async function route(origin,destination,key){
 const u=new URL('https://maps.googleapis.com/maps/api/distancematrix/json'); u.searchParams.set('origins',origin); u.searchParams.set('destinations',destination); u.searchParams.set('region','br'); u.searchParams.set('language','pt-BR'); u.searchParams.set('key',key);
 const j=await fetch(u,{cache:'no-store'}).then(r=>r.json()); const x=j.rows?.[0]?.elements?.[0]; if(!x||x.status!=='OK') return null;
 return {distanceKm:Math.round(x.distance.value/100)/10,travelMinutes:Math.round(x.duration.value/60),distanceText:x.distance.text,durationText:x.duration.text};
}
function logisticsImpact({distanceKm,travelMinutes,receptionHours,eventTime}){
 let impact=0; const reasons=[];
 if(distanceKm>35){ impact+=200; reasons.push('deslocamento fora da base próxima'); }
 if(distanceKm>100){ impact+=200; reasons.push('distância relevante'); }
 if(travelMinutes>150){ impact+=200; reasons.push('tempo de viagem elevado'); }
 const hour=Number(String(eventTime||'').slice(0,2)); const finish=Number.isFinite(hour)?hour+1+Number(receptionHours||0):null;
 const overnight=finish!==null && finish>=21 && travelMinutes>=120;
 if(overnight){ impact+=400; reasons.push('risco operacional de retorno/pernoite'); }
 return {suggestedSurcharge:impact,overnightLikely:overnight,reasons};
}
export async function POST(request){
 const supabase=getSupabaseAdmin();
 try{
  const auth=await requireWorkspaceAdmin({supabase,request,logPrefix:'[QUOTES_ANALYZE]'}); if(!auth.ok)return NextResponse.json({ok:false,message:auth.error},{status:auth.status||401});
  const body=await request.json(); const date=body.eventDate||new Date().toISOString().slice(0,10); const formation=slug(body.formation); const receptionHours=Number(body.receptionHours||0);
  const {data:rules,error}=await supabase.from('quote_price_rules').select('*').eq('workspace_id',auth.workspaceId); if(error)throw error;
  const pick=(category,key)=>Number((rules||[]).filter(r=>r.category===category&&r.item_key===key&&validRule(r,date)).sort((a,b)=>b.valid_from.localeCompare(a.valid_from))[0]?.amount||0);
  const base=pick('ceremony',formation), reception=receptionHours?pick('reception',formation+'_'+receptionHours+'h'):0, sound=body.hasSound?pick('sound',receptionHours?'church_reception':'church'):0;
  let logistics={suggestedSurcharge:0,overnightLikely:false,reasons:[]}, location=null, routing=null;
  const mapsKey=String(process.env.GOOGLE_MAPS_KEY||'').trim();
  if(body.location && mapsKey){ location=await geocode(body.location,mapsKey); if(location){ routing=await route(ORIGIN,location.address,mapsKey); if(routing)logistics=logisticsImpact({...routing,receptionHours,eventTime:body.eventTime}); } }
  const localCeremonyFee=pick('musician_fee','ceremony_local')||350;
  const localReceptionFee=pick('musician_fee','reception_local')||400;
  const outsideFee=pick('musician_fee','outside_base')||400;
  const standardTrip=pick('transport','standard_trip')||200;
  const isOutside=Boolean(routing && routing.distanceKm>35);
  const longCommitment=Boolean(receptionHours>=3 || (routing && routing.travelMinutes>=150));
  let unitFee=isOutside?outsideFee:localCeremonyFee;
  if(receptionHours>0) unitFee=Math.max(unitFee,localReceptionFee);
  if(longCommitment && routing?.travelMinutes>=180) unitFee=Math.max(unitFee,600);
  if(logistics.overnightLikely) unitFee=Math.max(unitFee,800);
  const estimatedMusicianCost=money(musicianCount(formation)*unitFee);
  const transportOperationalCost=money(logistics.suggestedSurcharge>0?Math.max(standardTrip,logistics.suggestedSurcharge):0);
  const estimatedCost=money(estimatedMusicianCost+transportOperationalCost);
  const tableTotal=money(base+reception+sound+logistics.suggestedSurcharge);
  const healthyFloor=money(Math.max(estimatedCost*1.45,tableTotal*0.88));
  const commercial=money(Math.max(healthyFloor,tableTotal*0.94));
  const suggested=money(Math.max(commercial,tableTotal));
  const analysis=[routing?`${routing.distanceText} / ${routing.durationText} por trecho a partir da base logística.`:'Logística ainda sem rota confirmada.', logistics.reasons.length?`Atenções: ${logistics.reasons.join(', ')}.`:'Sem agravantes logísticos automáticos identificados.'].join(' ');
  return NextResponse.json({ok:true,pricing:{base,reception,sound,logistics:logistics.suggestedSurcharge,tableTotal,healthyFloor,commercial,suggested},costs:{musicianUnit:unitFee,musicianCost:estimatedMusicianCost,transportCost:transportOperationalCost,estimatedCost,estimatedProfit:money(suggested-estimatedCost),longCommitment},location,routing,logistics,analysis,origin:ORIGIN});
 }catch(error){console.error('[QUOTES_ANALYZE][ERROR]',error);return NextResponse.json({ok:false,message:error?.message||'Falha ao analisar orçamento.'},{status:500});}
}
