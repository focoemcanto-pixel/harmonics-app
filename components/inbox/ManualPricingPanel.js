'use client';

import { useCallback, useEffect, useState } from 'react';

const CATEGORY_LABELS = { ceremony: 'Cerimônia', reception: 'Receptivo adicional', sound: 'Sonorização', transport: 'Deslocamento', musician_fee: 'Cachê (interno)', other: 'Outros' };

async function api(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok && body?.ok !== false, body };
}

export default function ManualPricingPanel({ toast }) {
  const [markdown, setMarkdown] = useState('');
  const [preview, setPreview] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [dates, setDates] = useState({});
  const load = useCallback(async () => { const { ok, body } = await api('/api/ai/pricing-proposals'); if (ok) setProposals(body.proposals || []); }, []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  async function run(dryRun) {
    const { ok, body } = await api('/api/ai/manual/import', { method: 'POST', body: JSON.stringify({ markdown, dry_run: dryRun }) });
    if (!ok) return toast.error(body?.error || 'Falha na importação.');
    if (dryRun) setPreview(body);
    else { toast.success(`${body.knowledge.length} conhecimento(s) e ${body.pricing.length} proposta(s) criados, todos pendentes.`); setPreview(null); load(); }
  }
  async function decide(p, decision) {
    const { ok, body } = await api(`/api/ai/pricing-proposals/${p.id}`, { method: 'POST', body: JSON.stringify({ decision, valid_from: dates[p.id] || undefined }) });
    if (!ok) return toast.error(body?.error || 'Falha.');
    load();
  }
  async function readFile(e) {
    const file = e.target.files?.[0];
    if (file) setMarkdown(await file.text());
  }

  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-3xl border border-slate-200 bg-white p-4 text-slate-900">
        <h2 className="text-base font-bold">Importar Manual Mestre (Markdown)</h2>
        <p className="text-xs text-slate-500">Seções viram conhecimento pendente (sem valores no texto; itens “PENDENTE” exigem revisão). Tabelas viram propostas de preço pendentes; cachês e margens ficam só nas regras internas e nunca são ditos ao cliente. Nada entra em vigor sem aprovação.</p>
        <input type="file" accept=".md,text/markdown,text/plain" onChange={readFile} className="text-xs" />
        <textarea rows={4} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" placeholder="…ou cole o conteúdo do manual aqui" value={markdown} onChange={(e) => setMarkdown(e.target.value)} />
        <div className="flex gap-2">
          <button type="button" onClick={() => run(true)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Ver prévia</button>
          {preview ? <button type="button" onClick={() => run(false)} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Criar {preview.knowledge.length} conhecimentos + {preview.pricing.length} propostas</button> : null}
        </div>
        {preview ? (
          <div className="text-xs text-slate-600">
            <div>Conhecimento: {preview.knowledge.map((k) => `${k.title}${k.review?.required ? ' ⚠' : ''}`).join(' · ') || '—'}</div>
            <div className="mt-1">Tabelas: {Object.entries(preview.pricing.reduce((a, p) => ({ ...a, [p.category]: (a[p.category] || 0) + 1 }), {})).map(([k, v]) => `${CATEGORY_LABELS[k] || k}: ${v}`).join(' · ') || '—'}</div>
            <div className="mt-1">Já importados: {preview.skipped.knowledge} conhecimento(s), {preview.skipped.pricing} proposta(s).</div>
          </div>
        ) : null}
      </section>
      <section className="space-y-2 rounded-3xl border border-slate-200 bg-white p-4 text-slate-900">
        <h2 className="text-base font-bold">Propostas de tabela (aprovação do Owner)</h2>
        <p className="text-xs text-slate-500">Aprovar grava na tabela oficial de Orçamentos (quote_price_rules) com a vigência informada; a data do evento define qual tabela vale. Regras oficiais existentes nunca são sobrescritas.</p>
        {!proposals.length ? <p className="text-sm text-slate-500">Nenhuma proposta pendente.</p> : null}
        {proposals.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 border-b border-slate-100 py-1 text-xs">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{CATEGORY_LABELS[p.category] || p.category}</span>
            <span className="min-w-[180px]">{p.label}</span>
            <strong>R$ {Number(p.amount).toLocaleString('pt-BR')}</strong>
            <span className="text-slate-500">{p.metadata?.section} {p.valid_until ? `até ${p.valid_until}` : ''} {p.metadata?.pending_validity ? '· vigência a confirmar' : ''}</span>
            <input type="date" className="ml-auto rounded border border-slate-200 px-1" value={dates[p.id] || p.valid_from || ''} onChange={(e) => setDates({ ...dates, [p.id]: e.target.value })} title="Início da vigência" />
            <button type="button" onClick={() => decide(p, 'approved')} className="rounded-lg bg-emerald-600 px-2 py-1 font-semibold text-white">Aprovar</button>
            <button type="button" onClick={() => decide(p, 'rejected')} className="rounded-lg border border-slate-300 px-2 py-1 text-slate-700">Rejeitar</button>
          </div>
        ))}
      </section>
    </div>
  );
}
