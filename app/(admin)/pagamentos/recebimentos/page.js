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

export default function Page() { return <ProtectedRoute requiredRole="admin"><Receivables /></ProtectedRoute>; }

function Receivables() {
  const [data, setData] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(today().slice(0, 7)), [filter, setFilter] = useState("open"), [search, setSearch] = useState("");
  const [form, setForm] = useState(null), [withdrawal, setWithdrawal] = useState(null);
  async function load() {
    const response = await fetch("/api/operational-finance", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) throw new Error(json.message || "Falha ao carregar financeiro.");
    setData(json); return json;
  }
  useEffect(() => { const refresh = () => load().catch((e) => setError(e.message)); refresh(); window.addEventListener("focus", refresh); const timer = setInterval(refresh, 60000); return () => { window.removeEventListener("focus", refresh); clearInterval(timer); }; }, []);
  const overview = useMemo(() => data ? receivablesOverview(data.events, data.sheets, data.ledger, data.settings) : null, [data]);
  const period = overview?.months.find((item) => item.month === month) || { realized: 0, remaining: 0, expected: 0 };
  const rows = (overview?.rows || []).filter((row) => {
    const raw = search.trim().toLowerCase();
    const br = row.event_date?.split("-").reverse().join("/") || "";
    const term = `${row.event_name} ${row.event_date} ${br} ${row.location_name || ""}`.toLowerCase();
    if (raw && !term.includes(raw)) return false;
    if (filter === "open") return row.open > 0;
    if (filter === "partial") return row.status === "partial";
    if (filter === "paid") return row.status === "paid";
    return true;
  });

  async function postMovement(payload) {
    if (busy) return false; setBusy(true); setError("");
    try {
      const response = await fetch("/api/operational-finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "movement", ...payload, request_id: crypto.randomUUID() }) });
      const json = await response.json(); if (!response.ok) throw new Error(json.message || "Não foi possível registrar."); await load(); return true;
    } catch (e) { setError(e.message); return false; } finally { setBusy(false); }
  }
  async function saveReceipt(event) {
    event.preventDefault(); if (!form) return;
    if (await postMovement({ kind: "receipt", event_id: form.event_id, amount_cents: cents(form.amount), occurred_on: form.occurred_on, method: form.method, origin: "lançamento manual", notes: form.notes, proof_reference: "", in_opening: false })) setForm(null);
  }
  async function saveWithdrawal(event) {
    event.preventDefault(); if (!withdrawal) return;
    const notes = [withdrawal.category, withdrawal.notes].filter(Boolean).join(" • ");
    if (await postMovement({ kind: "withdrawal", event_id: null, amount_cents: cents(withdrawal.amount), occurred_on: withdrawal.occurred_on, method: withdrawal.method, destination: withdrawal.destination, notes, proof_reference: "", in_opening: false })) setWithdrawal(null);
  }

  if (!data || !overview) return <AdminShell><p>{error || "Carregando financeiro operacional..."}</p></AdminShell>;
  const cash = overview.cash || { current: 0, futureCosts: 0, futureMusicians: 0, futureOther: 0, remainingReceivables: overview.totals.open, projected: 0, operationalFree: 0 };
  return <AdminShell><main className="space-y-6 text-slate-900">
    <header className="rounded-3xl bg-slate-950 p-5 text-white shadow-lg sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wider text-violet-300">Harmonics • Financeiro operacional</p><h1 className="mt-1 text-3xl font-bold">Caixa vivo</h1><p className="mt-2 max-w-2xl text-slate-300">O dinheiro que existe agora, o que ainda entra e o que os próximos eventos ainda exigem.</p></div><div className="flex flex-wrap gap-2"><button className="rounded-xl bg-white px-4 py-2 font-semibold text-slate-950" onClick={() => setWithdrawal({ amount: "", occurred_on: today(), method: "Pix", destination: "Marcos", category: "Empréstimo", notes: "" })}>Registrar retirada</button><Link href="/pagamentos/operacional" className="rounded-xl border border-slate-600 px-4 py-2 font-semibold">Visão operacional completa</Link></div></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><DarkMetric title="Caixa real agora" value={cash.current} /><DarkMetric title="Ainda a receber" value={cash.remainingReceivables} /><DarkMetric title="Custos futuros" value={cash.futureCosts} /><DarkMetric title="Caixa projetado" value={cash.projected} strong /></div>
      <p className={`mt-4 rounded-2xl p-3 text-sm ${cash.projected < 0 ? "bg-red-950 text-red-100" : "bg-white/10 text-slate-200"}`}>{cash.projected < 0 ? `Atenção: os contratos e o caixa conhecidos ainda deixam uma necessidade de ${money(-cash.projected)} depois dos próximos compromissos.` : `Depois de receber os saldos conhecidos e cumprir os próximos eventos, a projeção é ${money(cash.projected)}.`}</p>
    </header>

    {error && <p className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric title="Cachês futuros" value={cash.futureMusicians} /><Metric title="Outros custos futuros" value={cash.futureOther} /><Metric title="Retiradas registradas" value={overview.totals.withdrawals} /><Metric title="Margem econômica dos contratos" value={overview.totals.margin} /></section>

    <section className={`${box} space-y-4`}><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold">Ritmo do mês</h2><p className="text-sm text-slate-600">O mês serve para leitura do fluxo. A busca de clientes abaixo é global e não fica presa ao mês.</p></div><label className="text-sm font-semibold">Mês de referência<input type="month" className={`${input} mt-1`} value={month} onChange={(e) => setMonth(e.target.value)} /></label></div><div className="grid gap-3 sm:grid-cols-3"><Metric title="Já entrou no mês" value={period.realized} /><Metric title="Ainda previsto no mês" value={period.remaining} /><Metric title="Total esperado do mês" value={period.expected} strong /></div><p className="rounded-xl bg-slate-50 p-3 text-sm">Cada recebimento novo aumenta o caixa real e reduz o saldo previsto do evento. Quando todos quitarem, o realizado alcança o total esperado sem duplicar receita.</p></section>

    <section className="space-y-3"><div><h2 className="text-xl font-bold">Checklist de recebimentos por evento</h2><p className="text-sm text-slate-600">Pesquise qualquer evento, inclusive de outro mês, pelo nome, data ou local.</p></div><div className="flex flex-wrap gap-2"><input className={`${input} max-w-md`} placeholder="Nome, 15/11/2026, local..." value={search} onChange={(e) => setSearch(e.target.value)} /><select className={`${input} max-w-xs`} value={filter} onChange={(e) => setFilter(e.target.value)}><option value="open">Ainda a receber</option><option value="partial">Parciais</option><option value="paid">Quitados</option><option value="all">Todos</option></select></div>
      {rows.map((row) => <article key={row.event_id} className={`${box} transition-shadow hover:shadow-md`}><div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-lg font-bold">{row.event_name}</h3><p className="text-sm text-slate-600">Evento {row.event_date?.split("-").reverse().join("/")}{row.location_name ? ` • ${row.location_name}` : ""}{row.due_on ? ` • previsão ${row.due_on.split("-").reverse().join("/")}` : ""}</p></div><strong className={tone[row.status]}>{label[row.status]}</strong></div><div className="mt-4 grid gap-3 sm:grid-cols-4"><Mini title="Contratado" value={row.contract} /><Mini title="Já recebido" value={row.received} /><Mini title="Falta receber" value={row.open} strong /><Mini title="Resultado estimado" value={row.margin} /></div>{row.overdue && <p className="mt-3 text-sm font-semibold text-red-700">Previsão de recebimento vencida.</p>}<details className="mt-4 rounded-xl bg-slate-50 p-3"><summary className="cursor-pointer font-semibold">Histórico de lançamentos deste evento ({row.receipts.length})</summary>{row.receipts.length === 0 ? <p className="mt-2 text-sm text-slate-600">Nenhum recebimento registrado.</p> : row.receipts.map((entry) => <p key={entry.id} className="mt-2 border-t pt-2 text-sm">{money(entry.amount_cents)} • {entry.occurred_on?.split("-").reverse().join("/")} • {entry.method || "forma não informada"}{entry.notes ? ` • ${entry.notes}` : ""}</p>)}</details><div className="mt-3 flex flex-wrap gap-2">{row.open > 0 && <button className={primary} onClick={() => setForm({ event_id: row.event_id, event_name: row.event_name, amount: (row.open / 100).toFixed(2).replace(".", ","), occurred_on: today(), method: "Pix", notes: "" })}>Registrar recebimento</button>}<Link href={`/eventos/${row.event_id}`} className="rounded-xl border px-4 py-2 font-semibold">Abrir evento</Link></div></article>)}
    </section>

    {form && <Modal><form onSubmit={saveReceipt} className="space-y-3"><h2 className="text-xl font-bold">Registrar recebimento • {form.event_name}</h2><Field title="Valor (R$)"><input autoFocus required className={input} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field><Field title="Data"><input required type="date" max={today()} className={input} value={form.occurred_on} onChange={(e) => setForm({ ...form, occurred_on: e.target.value })} /></Field><Field title="Forma"><select className={input} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}><option>Pix</option><option>transferência</option><option>dinheiro</option><option>outro</option></select></Field><Field title="Observação"><input className={input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field><Actions busy={busy} onCancel={() => setForm(null)} label="Salvar e atualizar caixa" /></form></Modal>}
    {withdrawal && <Modal><form onSubmit={saveWithdrawal} className="space-y-3"><h2 className="text-xl font-bold">Registrar retirada</h2><p className="text-sm text-slate-600">A retirada reduz o caixa, mas não vira custo dos eventos.</p><Field title="Valor (R$)"><input autoFocus required className={input} value={withdrawal.amount} onChange={(e) => setWithdrawal({ ...withdrawal, amount: e.target.value })} /></Field><Field title="Tipo"><select className={input} value={withdrawal.category} onChange={(e) => setWithdrawal({ ...withdrawal, category: e.target.value })}><option>Empréstimo</option><option>Distribuição/Lucro</option><option>Pró-labore</option><option>Outros</option></select></Field><Field title="Destino"><input required className={input} value={withdrawal.destination} onChange={(e) => setWithdrawal({ ...withdrawal, destination: e.target.value })} /></Field><Field title="Data"><input required type="date" max={today()} className={input} value={withdrawal.occurred_on} onChange={(e) => setWithdrawal({ ...withdrawal, occurred_on: e.target.value })} /></Field><Field title="Observação"><input className={input} value={withdrawal.notes} onChange={(e) => setWithdrawal({ ...withdrawal, notes: e.target.value })} /></Field><Actions busy={busy} onCancel={() => setWithdrawal(null)} label="Registrar retirada" /></form></Modal>}
  </main></AdminShell>;
}
function Metric({ title, value, strong }) { return <div className={`${box} ${strong ? "border-violet-400 bg-violet-50" : ""}`}><p className="text-sm text-slate-600">{title}</p><strong className={`mt-1 block text-2xl ${value < 0 ? "text-red-700" : ""}`}>{money(value)}</strong></div>; }
function DarkMetric({ title, value, strong }) { return <div className={`rounded-2xl border p-4 ${strong ? "border-violet-400 bg-violet-500/15" : "border-slate-700 bg-white/5"}`}><p className="text-sm text-slate-300">{title}</p><strong className={`mt-1 block text-2xl ${value < 0 ? "text-red-300" : "text-white"}`}>{money(value)}</strong></div>; }
function Mini({ title, value, strong }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{title}</p><strong className={strong ? "text-emerald-700" : ""}>{money(value)}</strong></div>; }
function Modal({ children }) { return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">{children}</div></div>; }
function Field({ title, children }) { return <label className="block text-sm font-semibold">{title}<div className="mt-1">{children}</div></label>; }
function Actions({ busy, onCancel, label }) { return <div className="flex gap-2"><button disabled={busy} className={primary}>{label}</button><button type="button" className="rounded-xl border px-4 py-2" onClick={onCancel}>Cancelar</button></div>; }
