'use client';

import { useMemo, useState } from 'react';

const STATUS_COLOR = { importado: 'text-emerald-300', conflito: 'text-amber-300', inválido: 'text-rose-300', sincronizado: 'text-cyan-300', falha: 'text-rose-300' };

function parseCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/);
  if (lines.length <= 1) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',');
    const row = {};
    headers.forEach((header, index) => { row[header] = (values[index] || '').trim(); });
    return row;
  });
}

export default function MigracaoAdminPage() {
  const [rows, setRows] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const conflicts = useMemo(() => rows.filter((r) => !r.email || !r.stripe_customer_id || !r.stripe_subscription_id || !r.plan), [rows]);

  async function importBatch() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/migration/import', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ members: rows }),
      });
      const json = await res.json();
      setResults(json?.results || []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <h1 className="text-4xl font-black">Migração Stripe/PMS</h1>
      <p className="mt-2 text-slate-300">Upload CSV, preview, validação e importação incremental em lote.</p>
      <label className="mt-6 block rounded-2xl border border-white/20 bg-white/5 p-5">
        <span className="text-sm font-bold">CSV (email,name,plan,status,stripe_customer_id,stripe_subscription_id,next_billing_at)</span>
        <input type="file" accept=".csv" className="mt-3 block" onChange={async (e) => {
          const file = e.target.files?.[0]; if (!file) return;
          setRows(parseCsv(await file.text()));
        }} />
      </label>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">Conflitos detectados: <strong>{conflicts.length}</strong></div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/10"><tr><th className="p-2">Email</th><th>Plano</th><th>Status</th><th>Stripe Customer</th><th>Stripe Sub</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={`${r.email}-${i}`} className="border-t border-white/10"><td className="p-2">{r.email}</td><td>{r.plan}</td><td>{r.status}</td><td>{r.stripe_customer_id}</td><td>{r.stripe_subscription_id}</td></tr>)}</tbody>
        </table>
      </div>

      <button disabled={loading || rows.length === 0} onClick={importBatch} className="mt-5 rounded-xl bg-violet-600 px-4 py-2 font-bold disabled:opacity-40">{loading ? 'Importando...' : 'Importar em lote'}</button>

      <div className="mt-6 space-y-2">{results.map((r, i) => <div key={`${r.email}-${i}`} className="rounded-xl border border-white/10 p-3"><span className="font-bold">{r.email}</span> · <span className={STATUS_COLOR[r.status] || 'text-slate-200'}>{r.status}</span>{r.error ? ` · ${r.error}` : ''}</div>)}</div>
    </div>
  );
}
