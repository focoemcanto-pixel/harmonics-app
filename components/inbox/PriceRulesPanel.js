'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildTierGrid, itemLabel, normalizeTierSlug, parseTieredKey, tierLabel } from '@/lib/quotes/tiers.mjs';

// Tabelas oficiais de preço com vigência (fonte única da Nara, Orçamentos, Eventos e painel do cliente).
// Owner/Admin consultam; somente o Owner cria nova vigência: prévia → motivo → confirmação (auditado).
const CATEGORY_LABELS = { ceremony: 'Cerimônia', reception: 'Receptivo', sound: 'Sonorização', transport: 'Deslocamento', musician_fee: 'Custo interno', other: 'Outros' };
const WARNING_LABELS = {
  same_amount_as_current: 'O valor é igual ao da regra vigente.',
  future_rule_kept: 'Existe uma regra futura: a nova termina na véspera dela.',
  retroactive_start: 'Início no passado: só afeta novos cálculos; valores já salvos não mudam.',
};
const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const today = () => new Date().toISOString().slice(0, 10);
const day = (v) => (v ? String(v).slice(0, 10) : null);

async function api(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok && body?.ok !== false, body };
}

export default function PriceRulesPanel({ toast }) {
  const [data, setData] = useState({ rules: [], changes: [], tiers: [], is_owner: false });
  const [category, setCategory] = useState('ceremony');
  const [view, setView] = useState('grid');
  const [refDate, setRefDate] = useState(today());
  const [newTiers, setNewTiers] = useState([]);
  const [tierName, setTierName] = useState('');
  const [form, setForm] = useState(null);
  const [preview, setPreview] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { ok, body } = await api('/api/pricing/rules');
    if (ok) setData(body);
  }, []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  const groups = useMemo(() => {
    const out = new Map();
    for (const r of data.rules.filter((x) => x.category === category)) {
      if (!out.has(r.item_key)) out.set(r.item_key, []);
      out.get(r.item_key).push(r);
    }
    return [...out.entries()];
  }, [data.rules, category]);

  const tiers = useMemo(() => {
    const known = data.tiers || [];
    const extra = newTiers.filter((s) => !known.some((t) => t.slug === s)).map((slug) => ({ slug, label: tierLabel(slug), areas: [], draft: true }));
    return [...known, ...extra];
  }, [data.tiers, newTiers]);
  const grid = useMemo(() => (['ceremony', 'reception'].includes(category)
    ? buildTierGrid({ rules: data.rules, category, tiers, refDate }) : []), [data.rules, category, tiers, refDate]);
  const gridMode = view === 'grid' && ['ceremony', 'reception'].includes(category);

  function addTier() {
    const slug = normalizeTierSlug(tierName);
    if (!slug || slug === 'base') return toast.error('Informe um nome de faixa válido (ex.: Litoral Norte).');
    if (tiers.some((t) => t.slug === slug)) return toast.error('Essa faixa já existe.');
    setNewTiers([...newTiers, slug]); setTierName('');
    toast.success('Faixa adicionada à grade. Ela passa a existir ao confirmar o primeiro preço.');
  }

  function startChange(itemKey, rows, labelOverride = null) {
    const current = rows.find((r) => day(r.valid_from) <= today() && (!r.valid_until || day(r.valid_until) >= today())) || rows[rows.length - 1];
    const { key, tier } = parseTieredKey(itemKey);
    setForm({ category, item_key: itemKey, label: current?.label || labelOverride || itemLabel(category, key, tier), amount: current ? Number(current.amount) : '', valid_from: '' });
    setPreview(null);
    setReason('');
  }
  async function runPreview() {
    setBusy(true);
    const { ok, body } = await api('/api/pricing/rules/preview', { method: 'POST', body: JSON.stringify({ ...form, amount: Number(form.amount) }) });
    setBusy(false);
    if (!ok) return toast.error(body?.error || (body?.errors || []).join(', ') || 'Prévia inválida.');
    setPreview(body);
  }
  async function confirm() {
    if (reason.trim().length < 3) return toast.error('Informe o motivo da alteração.');
    setBusy(true);
    const { ok, body } = await api('/api/pricing/rules', {
      method: 'POST',
      body: JSON.stringify({ ...form, amount: Number(form.amount), reason, expected_hash: preview.expected_hash, confirm: true }),
    });
    setBusy(false);
    if (!ok) return toast.error(body?.error || 'Falha ao gravar.');
    toast.success('Nova vigência registrada.');
    setForm(null); setPreview(null); setReason('');
    load();
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 text-slate-900">
        <h2 className="text-base font-bold">Tabelas oficiais de preço</h2>
        <p className="text-xs text-slate-500">
          Fonte única para a Nara, Orçamentos, Eventos e o painel do cliente. A data do evento define a regra. Alterar cria uma nova
          vigência e encerra a anterior na véspera; nada é apagado e valores já salvos em eventos e contratos não mudam.
          {data.is_owner ? '' : ' Somente o Owner pode alterar.'}
        </p>
        <div className="flex flex-wrap gap-1">
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <button key={k} type="button" onClick={() => setCategory(k)} className={`rounded-full px-3 py-1 text-xs font-semibold ${category === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{v}</button>
          ))}
        </div>
        {['ceremony', 'reception'].includes(category) ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button type="button" onClick={() => setView('grid')} className={`rounded-lg px-2 py-1 font-semibold ${view === 'grid' ? 'bg-violet-600 text-white' : 'border border-slate-300 text-slate-700'}`}>Por faixa</button>
            <button type="button" onClick={() => setView('list')} className={`rounded-lg px-2 py-1 font-semibold ${view === 'list' ? 'bg-violet-600 text-white' : 'border border-slate-300 text-slate-700'}`}>Lista de regras</button>
            {gridMode ? <label className="ml-auto flex items-center gap-1">Valores vigentes em<input type="date" className="rounded border border-slate-200 px-1" value={refDate} onChange={(e) => setRefDate(e.target.value || today())} /></label> : null}
          </div>
        ) : null}

        {gridMode ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Região-base = Salvador e áreas sem faixa. Cada localidade herda os preços da faixa a que está vinculada (aba Localidades). Célula vazia = sem preço cadastrado: a Nara não informa valor e gera pendência.</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-1 pr-2">{category === 'ceremony' ? 'Formação' : 'Receptivo'}</th>
                    {tiers.map((t) => (
                      <th key={t.slug} className="px-2 py-1 align-bottom">
                        <div className="font-semibold text-slate-800">{t.label}{t.draft ? ' (nova)' : ''}</div>
                        <div className="font-normal text-slate-400">{(t.areas || []).length ? (t.areas || []).map((a) => `${a.name}${a.active ? '' : ' (inativa)'}`).join(', ') : t.slug === 'base' ? 'áreas sem faixa' : 'nenhuma localidade'}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.map((row) => (
                    <tr key={row.key} className="border-t border-slate-100 align-top">
                      <td className="py-2 pr-2 font-semibold text-slate-800">{row.label}</td>
                      {row.cells.map((c) => (
                        <td key={c.itemKey} className="px-2 py-2">
                          <div className={c.current ? 'font-bold text-emerald-700' : 'text-slate-400'}>{c.current ? money(c.current.amount) : '—'}</div>
                          {c.current?.valid_until ? <div className="text-slate-400">até {day(c.current.valid_until)}</div> : null}
                          {c.future.map((f) => <div key={f.id} className="text-slate-500">a partir de {day(f.valid_from)}: {money(f.amount)}</div>)}
                          {data.is_owner ? <button type="button" onClick={() => startChange(c.itemKey, c.history, c.label)} className="mt-1 rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-700">{c.history.length ? 'Nova vigência' : 'Definir valor'}</button> : null}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.is_owner ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <input className="rounded-xl border border-slate-200 px-2 py-1" placeholder="Nova faixa personalizada (ex.: Litoral Norte)" value={tierName} onChange={(e) => setTierName(e.target.value)} />
                <button type="button" onClick={addTier} className="rounded-lg border border-slate-300 px-2 py-1 font-semibold text-slate-700">Adicionar faixa</button>
              </div>
            ) : null}
          </div>
        ) : null}

        {!gridMode && !groups.length ? <p className="text-sm text-slate-500">Nenhuma regra nesta categoria.</p> : null}
        {!gridMode && groups.map(([itemKey, rows]) => (
          <div key={itemKey} className="rounded-2xl border border-slate-100 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-sm">{rows[rows.length - 1]?.label || itemKey}</strong>
              {data.is_owner ? <button type="button" onClick={() => startChange(itemKey, rows)} className="rounded-lg border border-slate-300 px-2 py-1 font-semibold text-slate-700">Nova vigência</button> : null}
            </div>
            <div className="mt-1 text-slate-500">{itemKey}</div>
            {rows.map((r) => {
              const active = day(r.valid_from) <= today() && (!r.valid_until || day(r.valid_until) >= today());
              return (
                <div key={r.id} className="mt-1 flex flex-wrap gap-2">
                  <span className={active ? 'font-bold text-emerald-700' : 'text-slate-600'}>{money(r.amount)}</span>
                  <span className="text-slate-500">de {day(r.valid_from)} {r.valid_until ? `até ${day(r.valid_until)}` : 'sem data final'}</span>
                  {active ? <span className="rounded-full bg-emerald-50 px-2 text-emerald-700">vigente hoje</span> : null}
                </div>
              );
            })}
          </div>
        ))}
      </section>

      {form ? (
        <section className="space-y-2 rounded-3xl border border-violet-200 bg-violet-50 p-4 text-sm text-slate-900">
          <h3 className="font-bold">Nova vigência — {form.label}</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs">Valor (R$)<input type="number" min="0" step="0.01" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={form.amount} onChange={(e) => { setForm({ ...form, amount: e.target.value }); setPreview(null); }} /></label>
            <label className="text-xs">Início da vigência (data do evento)<input type="date" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={form.valid_from} onChange={(e) => { setForm({ ...form, valid_from: e.target.value }); setPreview(null); }} /></label>
            <div className="flex items-end gap-2">
              <button type="button" disabled={busy || !form.valid_from || form.amount === ''} onClick={runPreview} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Ver prévia</button>
              <button type="button" onClick={() => { setForm(null); setPreview(null); }} className="rounded-xl border border-slate-300 px-3 py-2 text-xs">Cancelar</button>
            </div>
          </div>
          {preview ? (
            <div className="space-y-2 rounded-2xl bg-white p-3 text-xs">
              {preview.plan.ops.map((op, i) => (
                <div key={i}>{op.type === 'close'
                  ? `Encerra a regra vigente em ${op.valid_until}.`
                  : `Cria ${money(op.row.amount)} a partir de ${op.row.valid_from}${op.row.valid_until ? ` até ${op.row.valid_until}` : ', sem data final'}.`}</div>
              ))}
              {(preview.plan.warnings || []).map((w) => <div key={w} className="text-amber-700">{WARNING_LABELS[w] || w}</div>)}
              <div className="text-slate-500">Já salvos na nova vigência: {preview.saved_in_window?.events ?? '—'} evento(s) e {preview.saved_in_window?.precontracts ?? '—'} pré-contrato(s) — mantêm os valores combinados.</div>
              <label className="block">Motivo (fica no histórico)<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
              <button type="button" disabled={busy} onClick={confirm} className="rounded-xl bg-emerald-600 px-3 py-2 font-semibold text-white disabled:opacity-50">Confirmar nova vigência</button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-1 rounded-3xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
        <h3 className="text-sm font-bold text-slate-900">Histórico de alterações</h3>
        {!data.changes.length ? <p className="text-slate-500">Nenhuma alteração registrada pela Central.</p> : null}
        {data.changes.map((c) => (
          <div key={c.id} className="border-b border-slate-100 py-1">
            {new Date(c.created_at).toLocaleString('pt-BR')} · {CATEGORY_LABELS[c.category] || c.category} / {itemLabel(c.category, parseTieredKey(c.item_key).key, parseTieredKey(c.item_key).tier)}: {c.closed_rule ? `${money(c.closed_rule.amount)} → ` : ''}{money(c.new_rule?.amount)} a partir de {day(c.new_rule?.valid_from)} — {c.reason}
          </div>
        ))}
      </section>
    </div>
  );
}
