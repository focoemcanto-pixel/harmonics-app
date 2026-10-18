"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import { cents, money, today } from "@/lib/operational-finance/model.mjs";
import { receivablesOverview } from "@/lib/operational-finance/receivables.mjs";

const box = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";
const input = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base";
const primary = "rounded-xl bg-violet-700 px-4 py-2 font-semibold text-white disabled:opacity-50";
const label = { pending: "Não recebido", partial: "Parcial", paid: "Quitado", overpaid: "Conferir excesso" };
const tone = { pending: "text-amber-700", partial: "text-blue-700", paid: "text-emerald-700", overpaid: "text-red-700" };

export default function Page() {
  return <ProtectedRoute requiredRole="admin"><Receivables /></ProtectedRoute>;
}

function Receivables() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [filter, setFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);

  async function load() {
    const response = await fetch("/api/operational-finance", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) throw new Error(json.message || "Falha ao carregar financeiro.");
    setData(json);
    return json;
  }
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  const overview = useMemo(() => data ? receivablesOverview(data.events, data.sheets, data.ledger) : null, [data]);
  const period = overview?.months.find((item) => item.month === month) || { realized: 0, remaining: 0, expected: 0 };
  const rows = (overview?.rows || []).filter((row) => {
    const term = `${row.event_name} ${row.event_date}`.toLowerCase();
    const matches = term.includes(search.toLowerCase());
    if (!matches) return false;
    if (filter === "open") return row.open > 0;
    if (filter === "partial") return row.status === "partial";
    if (filter === "paid") return row.status === "paid";
    return true;
  });

  async function saveReceipt(event) {
    event.preventDefault();
    if (!form || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/operational-finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "movement",
          kind: "receipt",
          event_id: form.event_id,
          amount_cents: cents(form.amount),
          occurred_on: form.occurred_on,
          method: form.method,
          origin: "lançamento manual",
          notes: form.notes,
          proof_reference: "",
          in_opening: false,
          request_id: crypto.randomUUID(),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Não foi possível registrar.");
      await load();
      setForm(null);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  if (!data || !overview) return <AdminShell><p>{error || "Carregando recebimentos..."}</p></AdminShell>;
  return (
    <AdminShell>
      <main className="space-y-5 text-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Recebimentos</h1>
            <p className="mt-1 text-slate-600">O que entrou, o que ainda falta e quais lançamentos já foram registrados.</p>
          </div>
          <Link href="/pagamentos/operacional" className="rounded-xl border px-4 py-2 font-semibold">Financeiro operacional</Link>
        </div>
        {error && <p className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}

        <section className={`${box} space-y-4`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Entradas de caixa</h2>
              <p className="text-sm text-slate-600">Recebimentos realizados abatem automaticamente o saldo previsto do evento.</p>
            </div>
            <label className="text-sm font-semibold">Mês<input type="month" className={`${input} mt-1`} value={month} onChange={(e) => setMonth(e.target.value)} /></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric title="Entrou no mês" value={period.realized} />
            <Metric title="Ainda a receber" value={period.remaining} />
            <Metric title="Total esperado" value={period.expected} strong />
          </div>
          <p className="rounded-xl bg-slate-50 p-3 text-sm">O total esperado não soma a previsão antiga por cima do que já entrou: ele é <strong>realizado + saldo restante</strong>.</p>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <Metric title="Recebido nos eventos conferidos" value={overview.totals.received} />
          <Metric title="Saldo ainda a receber" value={overview.totals.open} strong />
          <Metric title="Custos econômicos dos eventos" value={overview.totals.costs} />
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input className={`${input} max-w-sm`} placeholder="Buscar cliente ou data" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className={`${input} max-w-xs`} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="open">Ainda a receber</option><option value="partial">Parciais</option><option value="paid">Quitados</option><option value="all">Todos</option>
            </select>
          </div>
          {rows.map((row) => (
            <article key={row.event_id} className={box}>
              <div className="flex flex-wrap justify-between gap-3">
                <div><h3 className="text-lg font-bold">{row.event_name}</h3><p className="text-sm text-slate-600">Evento {row.event_date?.split("-").reverse().join("/")}{row.due_on ? ` • previsão ${row.due_on.split("-").reverse().join("/")}` : ""}</p></div>
                <strong className={tone[row.status]}>{label[row.status]}</strong>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <Mini title="Contratado" value={row.contract} /><Mini title="Já recebido" value={row.received} /><Mini title="Falta receber" value={row.open} strong /><Mini title="Custo do evento" value={row.costs} />
              </div>
              {row.overdue && <p className="mt-3 text-sm font-semibold text-red-700">Previsão de recebimento vencida.</p>}
              <details className="mt-3 rounded-xl bg-slate-50 p-3">
                <summary className="cursor-pointer font-semibold">Lançamentos já registrados ({row.receipts.length})</summary>
                {row.receipts.length === 0 ? <p className="mt-2 text-sm text-slate-600">Nenhum recebimento registrado.</p> : row.receipts.map((entry) => <p key={entry.id} className="mt-2 border-t pt-2 text-sm">{money(entry.amount_cents)} • {entry.occurred_on?.split("-").reverse().join("/")} • {entry.method || "forma não informada"}</p>)}
              </details>
              <div className="mt-3 flex flex-wrap gap-2">
                {row.open > 0 && <button className={primary} onClick={() => setForm({ event_id: row.event_id, event_name: row.event_name, amount: (row.open / 100).toFixed(2).replace(".", ","), occurred_on: today(), method: "Pix", notes: "" })}>Registrar recebimento</button>}
                <Link href={`/eventos/${row.event_id}`} className="rounded-xl border px-4 py-2 font-semibold">Abrir evento</Link>
              </div>
            </article>
          ))}
        </section>

        {form && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"><form onSubmit={saveReceipt} className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-5 shadow-xl"><h2 className="text-xl font-bold">Registrar recebimento • {form.event_name}</h2><label className="block text-sm font-semibold">Valor (R$)<input autoFocus required className={`${input} mt-1`} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label><label className="block text-sm font-semibold">Data<input required type="date" max={today()} className={`${input} mt-1`} value={form.occurred_on} onChange={(e) => setForm({ ...form, occurred_on: e.target.value })} /></label><label className="block text-sm font-semibold">Forma<select className={`${input} mt-1`} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}><option>Pix</option><option>transferência</option><option>dinheiro</option><option>outro</option></select></label><label className="block text-sm font-semibold">Observação<input className={`${input} mt-1`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label><div className="flex gap-2"><button disabled={busy} className={primary}>Salvar e abater do saldo</button><button type="button" className="rounded-xl border px-4 py-2" onClick={() => setForm(null)}>Cancelar</button></div></form></div>}
      </main>
    </AdminShell>
  );
}
function Metric({ title, value, strong }) { return <div className={`${box} ${strong ? "border-violet-400 bg-violet-50" : ""}`}><p className="text-sm text-slate-600">{title}</p><strong className="mt-1 block text-2xl">{money(value)}</strong></div>; }
function Mini({ title, value, strong }) { return <div><p className="text-xs text-slate-500">{title}</p><strong className={strong ? "text-emerald-700" : ""}>{money(value)}</strong></div>; }
