// Data-only enrichment of the existing signed bridge snapshot.
// No account mutations, fiscal instructions or personally identifying documents.
const roundCents=(n)=>Math.max(0,Math.round(Number(n||0)));
const toCents=(n)=>roundCents(Number(n||0)*100);
const safeDate=(d)=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||''))?String(d):null;
const LEGACY=[
 ['musician','musician_cost','Cachês dos músicos'],
 ['sound','sound_cost','Sonorização'],
 ['transport','extra_transport_cost','Deslocamento'],
 ['other','other_cost','Outros custos']
];

export function enrichBridgeReceivables(receivables,events,sheets,ledger){
 const byEvent=new Map((events||[]).map(e=>[String(e.id),e]));
 const bySheet=new Map((sheets||[]).map(s=>[String(s.event_id),s]));
 const reversed=new Set((ledger||[]).filter(l=>l.kind==='reversal'&&l.reverses_id).map(l=>String(l.reverses_id)));
 const paidByCost=new Map();
 for(const l of ledger||[])if(l.kind==='payment'&&l.cost_id&&!reversed.has(String(l.id))){
  const key=String(l.event_id)+':'+String(l.cost_id);
  paidByCost.set(key,(paidByCost.get(key)||0)+roundCents(l.amount_cents));
 }
 return (receivables||[]).map(r=>{
  const event=byEvent.get(String(r.event_id)),sheet=bySheet.get(String(r.event_id));
  if(!event)return {...r,cost_source:'unavailable',costs:[],costs_complete:false};
  const checked=sheet?.status==='checked'&&Array.isArray(sheet?.costs);
  let costs=[];
  if(checked){
   costs=sheet.costs.filter(c=>c&&c.excluded!==true&&roundCents(c.amount_cents)>0)
    .map(c=>{
     const amount=roundCents(c.amount_cents),paid=Math.min(amount,paidByCost.get(String(r.event_id)+':'+String(c.id))||0);
     return {id:String(c.id||''),category:String(c.category||'other'),description:String(c.description||'Custo do evento'),
      amount_cents:amount,paid_cents:paid,open_cents:amount-paid,due_on:safeDate(c.due_on)||safeDate(event.event_date),confirmed:true};
    });
  }else{
   costs=LEGACY.map(([category,field,description])=>({
    id:category,category,description,amount_cents:toCents(event[field]),paid_cents:0,
    open_cents:toCents(event[field]),due_on:safeDate(event.event_date),confirmed:false
   })).filter(c=>c.amount_cents>0);
  }
  const total=costs.reduce((n,c)=>n+c.amount_cents,0),open=costs.reduce((n,c)=>n+c.open_cents,0);
  return {...r,cost_source:checked?'operational_checked':costs.length?'legacy_estimate':'unverified',
   costs_complete:checked,costs,cost_total_cents:total,cost_open_cents:open,
   projected_margin_cents:roundCents(r.contract_cents)-total,
   is_demo:event.is_demo===true};
 });
}
