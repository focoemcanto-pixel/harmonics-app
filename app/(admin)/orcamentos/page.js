'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calculator, ChevronRight, MapPin, Sparkles, SlidersHorizontal, WalletCards } from 'lucide-react';
import AdminShell from '@/components/layout/AdminShell';
import { supabase } from '@/lib/supabase';
import useCurrentWorkspace from '@/hooks/useCurrentWorkspace';

const money = (v) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const FORMATIONS=['Solo','Duo','Trio','Quarteto','Quinteto','Sexteto'];
const slug=(v)=>String(v||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();

export default function OrcamentosPage(){
 const { workspace } = useCurrentWorkspace();
 const [rules,setRules]=useState([]);
 const [form,setForm]=useState({formation:'Trio',date:'',time:'',location:'',reception:'0',sound:false});
 const [result,setResult]=useState(null);
 const [analyzing,setAnalyzing]=useState(false);
 const reception=Number(form.reception||0);
 useEffect(()=>{ if(!workspace?.id||!supabase)return; supabase.from('quote_price_rules').select('*').eq('workspace_id',workspace.id).then(({data})=>setRules(data||[])); },[workspace?.id]);
 const preview=useMemo(()=>{const d=form.date||new Date().toISOString().slice(0,10); const valid=(r)=>r.valid_from<=d&&(!r.valid_until||r.valid_until>=d); const base=Number(rules.filter(r=>r.category==='ceremony'&&r.item_key===slug(form.formation)&&valid(r)).sort((a,b)=>b.valid_from.localeCompare(a.valid_from))[0]?.amount||0); const recKey=`${slug(form.formation)}_${reception}h`; const rec=reception?Number(rules.filter(r=>r.category==='reception'&&r.item_key===recKey&&valid(r)).sort((a,b)=>b.valid_from.localeCompare(a.valid_from))[0]?.amount||0):0; const soundKey=reception?'church_reception':'church'; const sound=form.sound?Number(rules.filter(r=>r.category==='sound'&&r.item_key===soundKey&&valid(r)).sort((a,b)=>b.valid_from.localeCompare(a.valid_from))[0]?.amount||0):0; return {base,rec,sound,total:base+rec+sound};},[form,rules,reception]);
 async function analyze(){ setAnalyzing(true); try{ const res=await fetch('/api/quotes/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({formation:form.formation,eventDate:form.date,eventTime:form.time,location:form.location,receptionHours:Number(form.reception||0),hasSound:form.sound})}); const data=await res.json(); if(!res.ok||!data.ok) throw new Error(data.message||'Falha na análise'); setResult(data); }catch(e){setResult({error:e.message});}finally{setAnalyzing(false);} }
 return <AdminShell pageTitle="Orçamentos" activeItem="orcamentos" mobileSubtitle="Comercial inteligente">
  <div className="mx-auto max-w-6xl space-y-5 pb-28 md:pb-8">
   <section className="overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#111827_0%,#312e81_58%,#6d28d9_100%)] p-5 text-white shadow-[0_24px_70px_rgba(49,46,129,.22)] md:p-8">
    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-violet-200"><Sparkles size={15}/> Harmonics Intelligence</div>
    <h1 className="mt-3 text-3xl font-black tracking-[-.04em] md:text-4xl">Monte o orçamento sem adivinhar o preço.</h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-violet-100 md:text-base">Preço vigente, receptivo e logística entram na mesma análise. Você continua decidindo o valor final.</p>
   </section>
   <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
    <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm md:p-6">
     <div className="mb-5 flex items-center gap-3"><div className="rounded-2xl bg-violet-100 p-3 text-violet-700"><Calculator size={20}/></div><div><h2 className="font-black text-slate-900">Novo orçamento</h2><p className="text-sm text-slate-500">Comece com o essencial. O restante pode ser completado depois.</p></div></div>
     <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-bold text-slate-700">Formação<select value={form.formation} onChange={e=>setForm({...form,formation:e.target.value})} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4">{FORMATIONS.map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="text-sm font-bold text-slate-700">Data do evento<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4"/></label>
      <label className="text-sm font-bold text-slate-700">Horário<input type="time" value={form.time} onChange={e=>setForm({...form,time:e.target.value})} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4"/></label>
      <label className="text-sm font-bold text-slate-700">Receptivo<select value={form.reception} onChange={e=>setForm({...form,reception:e.target.value})} className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4"><option value="0">Sem receptivo</option><option value="1">1 hora</option><option value="2">2 horas</option><option value="3">3 horas</option></select></label>
     </div>
     <label className="mt-4 block text-sm font-bold text-slate-700">Local do evento<div className="relative mt-2"><MapPin className="absolute left-4 top-3.5 text-slate-400" size={18}/><input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Ex.: Espaço Aliança, Camaçari" className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4"/></div></label>
     <label className="mt-4 flex min-h-14 items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4"><span><b className="block text-sm text-slate-800">Incluir sonorização</b><span className="text-xs text-slate-500">Pode ser ajustado antes da aprovação</span></span><input type="checkbox" checked={form.sound} onChange={e=>setForm({...form,sound:e.target.checked})} className="h-5 w-5 accent-violet-600"/></label>
     <button onClick={analyze} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 font-black text-white shadow-lg shadow-violet-200 active:scale-[.99]">{analyzing?'Analisando local e preço...':'Analisar orçamento'} <ChevronRight size={18}/></button>
    </section>
    <section className="space-y-4">
     <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-sm font-black text-slate-900"><WalletCards size={18} className="text-violet-600"/>Prévia</div><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><span className="text-slate-500">Cerimônia</span><b>{money(preview.base)}</b></div><div className="flex justify-between"><span className="text-slate-500">Receptivo</span><b>{money(preview.rec)}</b></div><div className="flex justify-between"><span className="text-slate-500">Sonorização</span><b>{money(preview.sound)}</b></div><div className="border-t border-slate-100 pt-3 flex justify-between text-lg"><span className="font-black">Base</span><b className="text-violet-700">{money(preview.total)}</b></div></div></div>
     {result&&<div className="rounded-[28px] border border-violet-200 bg-violet-50 p-5"><div className="flex items-center gap-2 font-black text-violet-900"><SlidersHorizontal size={18}/>Análise inteligente</div>{result.error?<p className="mt-3 text-sm text-red-700">{result.error}</p>:<><p className="mt-3 text-sm leading-6 text-violet-900">{result.analysis}</p>{result.location?.address&&<p className="mt-2 text-xs text-violet-700">Local confirmado: {result.location.address}</p>}{result.routing&&<div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-2xl bg-white p-3"><span className="text-xs text-slate-400">Distância</span><b className="block text-slate-900">{result.routing.distanceText}</b></div><div className="rounded-2xl bg-white p-3"><span className="text-xs text-slate-400">Tempo</span><b className="block text-slate-900">{result.routing.durationText}</b></div></div>}<div className="mt-4 rounded-2xl bg-white p-4"><span className="text-xs font-black uppercase tracking-wider text-slate-400">Valor sugerido</span><div className="mt-1 text-2xl font-black text-slate-900">{money(result.pricing?.suggested)}</div><p className="mt-1 text-xs text-slate-500">Logística sugerida: {money(result.pricing?.logistics)}</p><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-slate-50 p-3"><span className="text-[11px] text-slate-400">Piso saudável</span><b className="block text-sm text-slate-900">{money(result.pricing?.healthyFloor)}</b></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-[11px] text-slate-400">Comercial</span><b className="block text-sm text-slate-900">{money(result.pricing?.commercial)}</b></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-[11px] text-slate-400">Custo estimado</span><b className="block text-sm text-slate-900">{money(result.costs?.estimatedCost)}</b></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-[11px] text-slate-400">Lucro estimado</span><b className="block text-sm text-slate-900">{money(result.costs?.estimatedProfit)}</b></div></div></div></>}</div>}
    </section>
   </div>
  </div>
 </AdminShell>;
}
