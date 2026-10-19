"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import FinancialReading from "@/components/finance/FinancialReading";
import AdminShell from "@/components/admin/AdminShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import { eventHistory, matchesEventSearch, receivablesOverview } from "@/lib/operational-finance/receivables.mjs";
import {
  cashPositionAt,
  financeDecision,
  isCancelledEvent,
  receiptDeadline,
  expectedReceiptDate,
  activeEntries,
  cents,
  dashboard,
  monthlyCommitments,
  eventSummary,
  excludeCost,
  restoreCost,
  describeReception,
  suggestedCosts,
  money,
  today,
} from "@/lib/operational-finance/model.mjs";
const input =
  "w-full min-h-11 rounded-[14px] border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-base text-[#0c0d12] outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100 md:text-[15px]";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#0c0d12] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50";
const ghost =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#e4e7ec] bg-white px-5 py-2.5 text-sm font-semibold text-[#0c0d12] transition hover:bg-[#f6f7f9] disabled:opacity-50";
const box = "rounded-[20px] border border-[#e4e7ec] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] md:p-5";
const status = (s) =>
  s === "checked"
    ? "CONFERIDO"
    : s === "draft"
      ? "EM CONFERÊNCIA"
      : "NÃO CONFERIDO";
function MoneyInput({ value, onValue }) {
  const [text, setText] = useState(String(value / 100));
  return (
    <input
      className={input}
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        try {
          onValue(cents(e.target.value || "0"));
        } catch {}
      }}
      onBlur={() => setText(String(value / 100))}
    />
  );
}
function EventServices({ event, compact = false }) {
  const yesNo = (value) =>
    value === true ? "Sim" : value === false ? "Não" : "Não informado";
  const request = String(event.antesala_request_status || "").toLowerCase();
  const hasAntesala =
    event.has_antesala === true ||
    event.antesala_enabled === true ||
    event.antesala_included === true;
  const antesala =
    request === "pending"
      ? "Solicitada — pendente de aprovação"
      : request === "rejected"
        ? "Não aprovada"
        : hasAntesala
          ? "Incluída"
          : [
                event.has_antesala,
                event.antesala_enabled,
                event.antesala_included,
              ].some((v) => v === false)
            ? "Não incluída"
            : "Não informado";
  const rows = [
    [
      "Formação",
      [event.formation, event.instruments].filter(Boolean).join(" • ") ||
        "Não informada",
    ],
    [
      "Antessala",
      [
        antesala,
        (hasAntesala || request === "pending") &&
        event.antesala_duration_minutes
          ? `${event.antesala_duration_minutes} min`
          : null,
        hasAntesala || request === "pending" ? event.antesala_package : null,
      ]
        .filter(Boolean)
        .join(" • "),
    ],
    ["Sonorização", yesNo(event.has_sound)],
    ["Receptivo", describeReception(event)],
    ["Transporte", yesNo(event.has_transport)],
  ];
  return (
    <div className="mt-3 rounded-[16px] border border-[#e4e7ec] bg-[#f6f7f9] p-3">
      {!compact && (
        <h3 className="mb-2 font-semibold">Definições cadastradas do evento</h3>
      )}
      <dl
        className={`grid gap-2 ${compact ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
      >
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0 text-sm">
            <dt className="text-slate-500">{label}</dt>
            <dd className="break-words font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {!compact && (
        <p className="mt-2 text-xs text-slate-600">
          Confira essas definições ao ajustar o contrato e os cachês. Serviços e
          acréscimos não são somados novamente ao valor contratado.
        </p>
      )}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label className="block space-y-1.5 text-[13px] font-medium text-[#586174]">
      <span>{label}</span>
      {children}
    </label>
  );
}
const TABS = [
  ["overview", "Visão geral"],
  ["events", "Eventos e recebimentos"],
  ["history", "Histórico"],
  ["musicians", "Músicos a pagar"],
  ["settings", "Configurações"],
];
const KIND_LABEL = {
  receipt: "Recebimento",
  payment: "Pagamento de custo",
  withdrawal: "Retirada pessoal",
  reversal: "Estorno",
  realized_cost: "Cachês e custos realizados (automático)",
  adjustment_in: "Ajuste de conciliação (+)",
  adjustment_out: "Ajuste de conciliação (−)",
};
const RECEIPT_STATUS = {
  pending: ["Não recebido", "bg-amber-50 text-amber-800 ring-amber-600/20"],
  partial: ["Parcial", "bg-sky-50 text-sky-700 ring-sky-600/15"],
  paid: ["Quitado", "bg-emerald-50 text-emerald-700 ring-emerald-600/15"],
  overpaid: ["Conferir excesso", "bg-red-50 text-red-700 ring-red-600/15"],
};
const br = (date) => (date ? date.split("-").reverse().join("/") : "—");
const monthLabel = (value) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T12:00:00Z`));
function Pill({ className = "", children }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${className}`}>{children}</span>;
}
function Amount({ value, className = "" }) {
  return <span className={`tabular-nums ${value < 0 ? "text-red-700" : ""} ${className}`}>{money(value)}</span>;
}
function Stat({ label, value, hint, strong }) {
  return (
    <div className={`${box} min-w-0`}>
      <div className="text-[13px] text-[#586174]">{label}</div>
      <div className={`mt-2 break-words text-[22px] font-semibold tracking-[-0.02em] md:text-[24px] ${strong ? "text-[#0c0d12]" : ""}`}><Amount value={value} /></div>
      {hint ? <div className="mt-1 text-[12px] text-[#8b93a3]">{hint}</div> : null}
    </div>
  );
}
function Modal({ title, subtitle, onClose, children }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[150] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] bg-white p-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] shadow-[0_24px_64px_rgba(16,24,40,0.16)] sm:max-w-2xl sm:rounded-[24px] sm:pb-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[19px] font-semibold tracking-[-0.02em]">{title}</h2>
            {subtitle ? <p className="mt-1 text-[13px] text-[#586174]">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f6f7f9] text-lg">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <ProtectedRoute requiredRole="admin">
      <Suspense fallback={null}>
        <Finance />
      </Suspense>
    </ProtectedRoute>
  );
}

function Finance() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTab = searchParams?.get("tab");
  const tab = TABS.some(([key]) => key === urlTab) ? urlTab : "overview";
  const [month, setMonth] = useState(today().slice(0, 7));
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("open"),
    [draft, setDraft] = useState(null),
    [movement, setMovement] = useState(null),
    [movementSearch, setMovementSearch] = useState(""),
    [musician, setMusician] = useState(""),
    [historyKind, setHistoryKind] = useState("all"),
    [reconcile, setReconcile] = useState(null);
  const [opening, setOpening] = useState({ opening_on: today(), amount: "" }),
    [defaultForm, setDefaultForm] = useState({ key: "", amount: "" });
  function setTab(key) {
    setDraft(null);
    router.replace(key === "overview" ? "/pagamentos/operacional" : `/pagamentos/operacional?tab=${key}`, { scroll: false });
  }
  async function load() {
    const r = await fetch("/api/operational-finance", { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) throw new Error(j.message);
    setData(j);
    return j;
  }
  useEffect(() => {
    const refresh = () => load().catch((e) => setError(e.message));
    refresh();
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 60000);
    return () => {
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
    };
  }, []);
  async function run(command) {
    if (busy) return null;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/operational-finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...command, request_id: command.request_id || crypto.randomUUID() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message);
      const next = await load();
      setNotice("Salvo no financeiro operacional.");
      return next;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  // Fonte única: todos os números desta tela saem do mesmo motor (dashboard/cashPosition).
  const stats = useMemo(() => (data ? dashboard(data.events, data.sheets, data.ledger, data.settings) : null), [data]);
  const decision = useMemo(() => data ? financeDecision(data.events, data.sheets, data.ledger, data.settings) : null, [data]);
  const operation = decision?.months.find((row) => row.month === month);
  const planning = useMemo(() => (data ? monthlyCommitments(data.events, data.sheets, data.ledger) : null), [data]);
  const overview = useMemo(() => (data ? receivablesOverview(data.events, data.sheets, data.ledger, data.settings) : null), [data]);
  const period = planning?.months.find((row) => row.month === month) || { month, musician: 0, other: 0, total: 0, receivable: 0, receipts: [], unchecked: 0, items: [] };
  const realizedInMonth = overview?.months.find((row) => row.month === month)?.realized || 0;
  const remainingCommitments = operation?.commitments || 0;
  const monthlyResult = period.receivable - remainingCommitments;
  const accumulatedResult = planning ? planning.months.reduce((sum, row) => sum + row.receivable - row.total, 0) : 0;
  const accumulatedCash = stats ? stats.cash + accumulatedResult - (planning?.arrearsTotal || 0) : 0;
  const relevant = useMemo(
    () =>
      data
        ? data.events
            .filter((e) => data.sheets.some((s) => s.event_id === e.id) || (e.event_date >= today() && !isCancelledEvent(e)))
            .sort((a, b) => a.event_date.localeCompare(b.event_date))
        : [],
    [data],
  );
  const future = relevant.filter((e) => e.event_date >= today());
  // Checklist: cada evento relevante com recebimento, custos e conferência. Busca global (não depende do mês).
  const checklist = useMemo(() => {
    if (!data || !overview) return [];
    const byId = new Map(overview.rows.map((row) => [row.event_id, row]));
    return relevant
      .filter((e) => !isCancelledEvent(e))
      .map((e) => {
        const sheet = data.sheets.find((s) => s.event_id === e.id);
        const row = byId.get(e.id);
        const s = eventSummary(e, sheet, data.ledger);
        return {
          event: e,
          sheet,
          event_name: e.client_name,
          event_date: e.event_date,
          location_name: e.location_name,
          checked: s.checked,
          contract: s.contract,
          received: s.received,
          open: s.open,
          costs: s.total,
          margin: s.margin,
          status: row?.status || (s.overpayment > 0 ? "overpaid" : s.open === 0 && s.contract > 0 ? "paid" : s.received > 0 ? "partial" : "pending"),
          due_on: row?.due_on || null,
          overdue: Boolean(row?.overdue),
          past: e.event_date < today(),
        };
      });
  }, [data, overview, relevant]);
  // Com texto na busca, procura em todos os eventos (qualquer mês e status); sem texto, vale o filtro.
  const visible = checklist.filter((row) => {
    if (!matchesEventSearch(row, search)) return false;
    if (search.trim()) return true;
    if (filter === "open") return row.checked && row.open > 0;
    if (filter === "partial") return row.status === "partial";
    if (filter === "paid") return row.checked && row.status === "paid";
    if (filter === "unchecked") return !row.checked;
    return true;
  });
  function openEvent(e, source = data) {
    const saved = source.sheets.find((s) => s.event_id === e.id);
    const costs = suggestedCosts(e, saved?.costs, source.musicians, source.defaults, () => crypto.randomUUID());
    setDraft({
      event: e,
      revision: saved?.revision || 0,
      contract_cents: saved?.contract_cents ?? Math.round(Number(e.agreed_amount || 0) * 100),
      costs,
      expected_receipt_on: expectedReceiptDate(e, saved),
      status: saved?.status || "draft",
    });
    if (tab !== "events") router.replace("/pagamentos/operacional?tab=events", { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function saveEvent(next = false, checked = true) {
    const d = await run({
      action: "event",
      event_id: draft.event.id,
      revision: draft.revision,
      contract_cents: draft.contract_cents,
      costs: draft.costs,
      expected_receipt_on: draft.expected_receipt_on,
      status: checked ? "checked" : "draft",
    });
    if (!d) return;
    if (next) {
      const i = future.findIndex((e) => e.id === draft.event.id);
      const e = future.slice(i + 1).find((e) => d.sheets.find((s) => s.event_id === e.id)?.status !== "checked");
      if (e) openEvent(e, d);
      else {
        setDraft(null);
        setNotice("Conferência concluída para os próximos eventos.");
      }
    } else openEvent(draft.event, d);
  }
  function newMovement(kind, event_id = "", cost_id = "", amount = "") {
    setMovementSearch("");
    setMovement({
      kind,
      event_id,
      cost_id,
      amount,
      occurred_on: today(),
      method: "Pix",
      origin: kind === "receipt" ? "lançamento manual" : "WhatsApp",
      destination: "",
      category: "Empréstimo",
      notes: "",
      proof_reference: "",
      in_opening: false,
      request_id: crypto.randomUUID(),
    });
  }
  async function saveMovement(event) {
    event.preventDefault();
    try {
      const { category, ...rest } = movement;
      const next = await run({
        ...rest,
        action: "movement",
        amount_cents: cents(movement.amount),
        event_id: movement.event_id || null,
        notes: movement.kind === "withdrawal" ? [category, movement.notes].filter(Boolean).join(" • ") : movement.notes,
      });
      if (next) setMovement(null);
    } catch (e) {
      setError(e.message);
    }
  }
  function reverse(entry) {
    const notes = window.prompt(`Estornar ${KIND_LABEL[entry.kind]?.toLowerCase() || "lançamento"} de ${money(entry.amount_cents)}? Informe o motivo (obrigatório):`, entry.kind === "receipt" ? "Recebimento lançado em duplicidade" : "");
    if (notes?.trim()) run({ action: "reverse", entry_id: entry.id, notes });
  }
  function costEdit(index, patch) {
    setDraft((d) => ({ ...d, costs: d.costs.map((c, i) => (i === index ? { ...c, ...patch } : c)) }));
  }
  // Músicos a pagar: só eventos que ainda não aconteceram (após a data, o cachê é considerado pago).
  const debt = useMemo(() => {
    if (!data) return [];
    const map = new Map();
    for (const e of relevant) {
      if (isCancelledEvent(e) || e.event_date < today()) continue;
      const s = eventSummary(e, data.sheets.find((s) => s.event_id === e.id), data.ledger);
      if (!s.checked) continue;
      for (const c of s.costs.filter((c) => c.category === "musician")) {
        const key = c.musician_id || c.description;
        const row = map.get(key) || { key, name: c.description, total: 0, paid: 0, open: 0, events: [] };
        row.total += c.amount_cents;
        row.paid += c.paid;
        row.open += c.open;
        row.events.push({ event: e, cost: c });
        map.set(key, row);
      }
    }
    return [...map.values()].sort((a, b) => b.open - a.open);
  }, [data, relevant]);

  if (!data || !stats)
    return (
      <AdminShell pageTitle="Financeiro" activeItem="pagamentos" mobileSubtitle="Caixa, recebimentos e compromissos">
        <div className="space-y-4">
          <p role="alert" className="text-[14px] text-[#586174]">{error || "Carregando financeiro operacional..."}</p>
          {error ? <button className={button} onClick={() => load().catch((e) => setError(e.message))}>Tentar novamente</button> : <div className="hx-skeleton h-56 rounded-[24px]" />}
        </div>
      </AdminShell>
    );
  const position = stats.position;
  const current = draft ? eventSummary(draft.event, { ...draft, event_id: draft.event.id }, data.ledger) : null;
  const activeIds = new Set(activeEntries(data.ledger).map((x) => x.id));
  const eventName = (id) => data.events.find((e) => e.id === id)?.client_name;
  const draftHistory = draft ? eventHistory(draft.event, data.sheets.find((s) => s.event_id === draft.event.id), data.ledger, data.settings) : [];
  const fullHistory = [
    ...data.ledger.map((x) => ({ ...x, source: "ledger" })),
    ...position.realizedEvents.map((x) => ({ id: `realized:${x.event_id}`, source: "realized", kind: "realized_cost", event_id: x.event_id, amount_cents: x.total, musician_cents: x.musician, other_cents: x.other, occurred_on: x.event_date, created_at: `${x.event_date}T23:59:59Z` })),
  ]
    .filter((x) => historyKind === "all" || x.kind === historyKind || (historyKind === "adjustment" && String(x.kind).startsWith("adjustment_")))
    .sort((a, b) => String(b.occurred_on).localeCompare(String(a.occurred_on)) || String(b.created_at).localeCompare(String(a.created_at)));
  const movementEvents = relevant.filter((e) => e.id === movement?.event_id || matchesEventSearch({ event_name: e.client_name, event_date: e.event_date, location_name: e.location_name }, movementSearch));

  function historyRow(item) {
    const reversed = item.source === "ledger" && item.kind !== "reversal" && !activeIds.has(item.id);
    const sign = item.kind === "receipt" || item.kind === "adjustment_in" ? "+" : item.kind === "reversal" ? "↺" : "−";
    return (
      <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 border-t border-[#eceef2] py-3 first:border-t-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <strong className={`tabular-nums ${(item.kind === "receipt" || item.kind === "adjustment_in") && !reversed ? "text-emerald-700" : ""} ${reversed ? "line-through opacity-60" : ""}`}>{sign} {money(item.amount_cents)}</strong>
            <span className="text-[13px] text-[#586174]">{KIND_LABEL[item.kind]}</span>
            {item.in_opening ? <Pill className="bg-[#f2f4f7] text-[#475467] ring-[#475467]/10">Já incluído no caixa inicial</Pill> : null}
            {reversed ? <Pill className="bg-red-50 text-red-700 ring-red-600/15">Estornado</Pill> : null}
            {item.source === "realized" ? <Pill className="bg-violet-50 text-violet-700 ring-violet-600/15">Evento realizado</Pill> : null}
          </div>
          <p className="mt-0.5 text-[13px] text-[#586174]">
            {br(item.occurred_on)}
            {item.event_id && !draft ? ` • ${eventName(item.event_id) || "Evento"}` : item.destination ? ` • ${item.destination}` : ""}
            {item.source === "realized" ? ` • cachês ${money(item.musician_cents)}${item.other_cents ? ` • outros ${money(item.other_cents)}` : ""}` : item.method || item.origin ? ` • ${[item.method, item.origin].filter(Boolean).join(" • ")}` : ""}
          </p>
          {item.notes ? <p className="text-[13px] text-[#8b93a3]">{item.notes}</p> : null}
          {item.proof_reference ? <a href={item.proof_reference} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-violet-700">Comprovante</a> : null}
        </div>
        {item.source === "ledger" && activeIds.has(item.id) ? (
          <button disabled={busy} className="text-[13px] font-semibold text-red-700" onClick={() => reverse(item)}>Estornar / corrigir</button>
        ) : null}
      </div>
    );
  }

  return (
    <AdminShell pageTitle="Financeiro" activeItem="pagamentos" mobileSubtitle="Caixa, recebimentos e compromissos">
      <div className="space-y-5 text-[#0c0d12]">
        <header className="flex flex-col gap-4 pt-1 md:flex-row md:items-end md:justify-between md:pt-2">
          <div className="min-w-0">
            <h1 className="hidden text-[30px] font-semibold leading-tight tracking-[-0.03em] md:block lg:text-[34px]">Financeiro</h1>
            <p className="mt-1 hidden text-[14px] text-[#586174] md:block md:text-[15px]">Caixa real, recebimentos e compromissos dos eventos em um só lugar.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={!data.settings || busy} className={button} onClick={() => newMovement("receipt", draft?.event.id || "")}>+ Registrar recebimento</button>
            <button disabled={!data.settings || busy} className={ghost} onClick={() => newMovement("withdrawal")}>Registrar retirada</button>
            <button className={ghost} onClick={() => load().catch((e) => setError(e.message))} aria-label="Atualizar dados">Atualizar</button>
          </div>
        </header>

        <nav aria-label="Seções do financeiro" className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          <div className="inline-flex gap-1 rounded-full border border-[#e4e7ec] bg-white p-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            {TABS.map(([key, label]) => (
              <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)} className={`min-h-9 shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${tab === key ? "bg-[#0c0d12] text-white" : "text-[#586174] hover:bg-[#f6f7f9] hover:text-[#0c0d12]"}`}>
                {label}
              </button>
            ))}
            <Link href="/pagamentos" className="min-h-9 shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-medium text-[#8b93a3] hover:bg-[#f6f7f9]">Pagamentos / Legado</Link>
          </div>
        </nav>

        {error && <p role="alert" className="rounded-[16px] border border-red-200 bg-red-50 p-3 text-[14px] text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-[16px] border border-emerald-200 bg-emerald-50 p-3 text-[14px] text-emerald-800">{notice}</p>}

        {!data.settings && (
          <section className={box}>
            <h2 className="text-[18px] font-semibold">Defina o marco zero</h2>
            <p className="my-3 text-[14px] text-[#586174]">
              Informe quanto do dinheiro atual pertence à Harmonics. Recebimentos e pagamentos já incluídos nesse saldo devem ser marcados como históricos. O marco zero fica preservado após salvar.
            </p>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await run({ action: "opening", opening_on: opening.opening_on, opening_cents: cents(opening.amount) });
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              <Field label="Saldo inicial (R$)">
                <input required className={input} inputMode="decimal" value={opening.amount} onChange={(e) => setOpening({ ...opening, amount: e.target.value })} />
              </Field>
              <Field label="Data do marco zero">
                <input required type="date" max={today()} className={input} value={opening.opening_on} onChange={(e) => setOpening({ ...opening, opening_on: e.target.value })} />
              </Field>
              <button disabled={busy} className={button}>Definir marco zero</button>
            </form>
          </section>
        )}

        {tab === "overview" && (
          <>
            <FinancialReading decision={decision} planning={planning} events={data.events} sheets={data.sheets} month={month} setMonth={setMonth} onEvent={openEvent} onUnchecked={() => { setSearch(""); setFilter("unchecked"); setTab("events"); }} />

            <details className={`${box} group`}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                <div>
                  <h2 className="text-[16px] font-semibold">Como o caixa real foi calculado</h2>
                  <p className="text-[13px] text-[#586174]">Conta completa desde o marco zero{position.opening_on ? ` (${br(position.opening_on)})` : ""}.</p>
                </div>
                <span className="text-[13px] font-semibold text-[#586174] group-open:hidden">Ver conta</span>
                <span className="hidden text-[13px] font-semibold text-[#586174] group-open:inline">Ocultar</span>
              </summary>
              <dl className="mt-4 divide-y divide-[#eceef2] text-[14px]">
                {[
                  ["Caixa inicial (marco zero)", position.opening, ""],
                  ["Recebimentos após o marco zero", position.receipts, "+"],
                  ["Retiradas", position.withdrawals, "−"],
                  ["Pagamentos de custos registrados", position.payments, "−"],
                  ["Cachês e custos de eventos realizados", position.realizedCosts, "−"],
                ].map(([label, value, op]) => (
                  <div key={label} className="flex items-center justify-between gap-3 py-2.5">
                    <dt className="text-[#586174]"><span className="mr-2 inline-block w-3 font-semibold text-[#0c0d12]">{op}</span>{label}</dt>
                    <dd className="font-semibold"><Amount value={value} /></dd>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="font-semibold"><span className="mr-2 inline-block w-3">=</span>Caixa reconstruído pelos registros</dt>
                  <dd className="font-semibold"><Amount value={position.reconstructed} /></dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-[#586174]"><span className="mr-2 inline-block w-3 font-semibold text-[#0c0d12]">±</span>Ajustes de conciliação</dt>
                  <dd className="font-semibold"><Amount value={position.adjustments} /></dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-3 text-[15px]">
                  <dt className="font-semibold"><span className="mr-2 inline-block w-3">=</span>Caixa real agora</dt>
                  <dd className="font-semibold"><Amount value={stats.cash} /></dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#e4e7ec] p-3">
                <p className="max-w-xl text-[13px] text-[#586174]">Conferiu o saldo no banco e há diferença residual? Registre um ajuste de conciliação: corrige o caixa, exige motivo, fica no histórico e não conta como retirada nem afeta a margem.</p>
                <button type="button" disabled={!data.settings || busy} className={ghost} onClick={() => setReconcile({ real: "", kind: "adjustment_out", amount: "", occurred_on: today(), notes: "", request_id: crypto.randomUUID() })}>Conciliar com saldo real</button>
              </div>
              <p className="mt-2 text-[12px] text-[#8b93a3]">
                Lançamentos marcados como “já incluído no caixa inicial” ficam no histórico sem movimentar o caixa. Estornos anulam o lançamento original{position.reversed ? ` (${position.reversed} estorno(s) após o marco zero)` : ""}. Depois da data do evento, os cachês e custos da ficha conferida contam como pagos — pagamentos já registrados para o mesmo custo não são descontados de novo.
              </p>
              {position.realizedEvents.length > 0 && (
                <div className="mt-3 rounded-[16px] bg-[#f6f7f9] p-3">
                  <p className="text-[13px] font-semibold">Eventos realizados após o marco zero</p>
                  {position.realizedEvents.map((x) => (
                    <button key={x.event_id} className="mt-1.5 flex w-full justify-between gap-3 text-left text-[13px]" onClick={() => { const e = data.events.find((ev) => ev.id === x.event_id); if (e) openEvent(e); }}>
                      <span className="truncate text-[#586174]">{br(x.event_date)} • {x.event_name}</span>
                      <span className="shrink-0 font-semibold">− {money(x.total)}</span>
                    </button>
                  ))}
                </div>
              )}
            </details>

            {(position.uncheckedPast.length > 0) && (
              <div className="rounded-[20px] border border-amber-200 bg-amber-50/70 p-4 text-[13px] text-amber-900">
                {position.uncheckedPast.length > 0 && (
                  <p>
                    <strong>{position.uncheckedPast.length} evento(s) já realizado(s) sem ficha conferida</strong> — os custos deles ainda não foram descontados do caixa real.{" "}
                    {position.uncheckedPast.slice(0, 4).map((x) => (
                      <button key={x.event_id} className="mr-2 font-semibold underline" onClick={() => { const e = data.events.find((ev) => ev.id === x.event_id); if (e) openEvent(e); }}>{x.event_name} ({br(x.event_date)})</button>
                    ))}
                  </p>
                )}

              </div>
            )}

            <details className={`${box} space-y-4`}>
              <summary className="cursor-pointer text-[15px] font-semibold">Explorar recebimentos e compromissos · {monthLabel(month)}</summary>
              <dl className="divide-y divide-[#eceef2] text-[13px]">
                {[["Já entrou no mês (por data de recebimento)", realizedInMonth], ["Ainda a receber no mês", period.receivable], [`Compromissos em ${monthLabel(month)}`, remainingCommitments], ["Cobertura futura do mês", monthlyResult]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-3"><dt className="text-[#586174]">{label}</dt><dd className="shrink-0 font-semibold tabular-nums">{money(value)}</dd></div>)}
              </dl>
              {period.unchecked > 0 ? <p className="text-[13px] text-amber-800">{period.unchecked} evento(s) deste mês ainda aguardam conferência.</p> : null}
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-[16px] bg-[#f6f7f9] p-3">
                  <h3 className="text-[14px] font-semibold">Recebimentos previstos em {monthLabel(month)}</h3>
                  <p className="text-[12px] text-[#8b93a3]">Sem data manual, a previsão usa dois dias antes do evento.</p>
                  {period.receipts.length === 0 && <p className="mt-2 text-[13px] text-[#586174]">Nenhum recebimento pendente previsto neste mês.</p>}
                  {period.receipts.map((item) => (
                    <button key={item.event_id} className="mt-2 flex w-full flex-wrap justify-between gap-2 rounded-[12px] bg-white p-3 text-left text-[13px]" onClick={() => { const e = data.events.find((ev) => ev.id === item.event_id); if (e) openEvent(e); }}>
                      <span><strong>{br(item.due_on)} • {item.event_name}</strong><span className="block text-[#8b93a3]">{item.date_source === "manual" ? "Previsão definida por você" : "Dois dias antes do evento"}{item.overdue ? " • Data prevista já passou" : ""}</span></span>
                      <strong className="text-emerald-700">{money(item.amount)}</strong>
                    </button>
                  ))}
                  {planning.overdueReceipts.length > 0 && (
                    <div className="mt-3 rounded-[12px] bg-amber-50 p-3 text-[13px]">
                      <strong>Recebimentos vencidos ou sem data: reprogramar previsão</strong>
                      <p className="text-[#586174]">Continuam a receber, mas não entram automaticamente na projeção de um mês futuro.</p>
                      {planning.overdueReceipts.map((item) => (
                        <button key={item.event_id} className="mt-1.5 block font-semibold text-violet-700" onClick={() => { const e = data.events.find((ev) => ev.id === item.event_id); if (e) openEvent(e); }}>{item.event_name} • {money(item.amount)} • Ajustar data prevista</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-[16px] bg-[#f6f7f9] p-3">
                  <h3 className="text-[14px] font-semibold">Compromissos por data em {monthLabel(month)}</h3>
                  <p className="text-[12px] text-[#8b93a3]">Cachês e custos de eventos futuros com ficha conferida.</p>
                  {period.items.length === 0 && <p className="mt-2 text-[13px] text-[#586174]">Nenhum custo pendente de ficha conferida neste mês.</p>}
                  {[...planning.arrears, ...period.items].map((item) => (
                    <button key={`${item.event_id}:${item.cost_id}`} className="mt-2 flex w-full flex-wrap justify-between gap-2 rounded-[12px] bg-white p-3 text-left text-[13px]" onClick={() => { const e = data.events.find((ev) => ev.id === item.event_id); if (e) openEvent(e); }}>
                      <span><strong>{br(item.due_on)} • {item.event_name}</strong><span className="block text-[#8b93a3]">{item.description}{item.overdue ? <span className="font-semibold text-red-700"> • Em atraso</span> : null}</span></span>
                      <strong>{money(item.amount)}</strong>
                    </button>
                  ))}
                </div>
              </div>
              <details className="rounded-[16px] border border-[#e4e7ec]">
                <summary className="cursor-pointer px-4 py-3 text-[14px] font-semibold">Entradas e compromissos de todos os meses</summary>
                <div className="overflow-x-auto px-2 pb-3">
                  <table className="w-full min-w-[640px] text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[#eceef2] text-[#586174]">
                        <th className="p-2 font-medium">Mês</th>
                        <th className="p-2 font-medium">Cachês</th>
                        <th className="p-2 font-medium">Outros custos</th>
                        <th className="p-2 font-medium">A receber</th>
                        <th className="p-2 font-medium">A pagar</th>
                        <th className="p-2 font-medium">Cobertura futura</th>
                        <th className="p-2 font-medium">A conferir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planning.months.map((row) => (
                        <tr key={row.month} className={`border-b border-[#eceef2] ${row.month === month ? "bg-[#f6f7f9]" : ""}`}>
                          <td className="p-2"><button className="font-semibold capitalize text-violet-700" onClick={() => setMonth(row.month)}>{monthLabel(row.month)}</button></td>
                          <td className="whitespace-nowrap p-2">{money(row.musician)}</td>
                          <td className="whitespace-nowrap p-2">{money(row.other)}</td>
                          <td className="whitespace-nowrap p-2">{money(row.receivable)}</td>
                          <td className="whitespace-nowrap p-2 font-semibold">{money(row.total)}</td>
                          <td className="whitespace-nowrap p-2"><span className={row.receivable - row.total < 0 ? "text-red-700" : "text-emerald-700"}>{money(row.receivable - row.total)}</span></td>
                          <td className="p-2">{row.unchecked || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold">
                        <td colSpan={5} className="p-2">Fluxo pendente acumulado dos meses exibidos</td>
                        <td className="whitespace-nowrap p-2">{money(accumulatedResult)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                  <p className="px-2 text-[12px] text-[#8b93a3]">Saldo de caixa projetado ao final de todos os meses: <strong>{money(accumulatedCash)}</strong> (caixa real + fluxo pendente acumulado).</p>
                </div>
              </details>
            </details>


          </>
        )}

        {tab === "events" && !draft && (
          <section className="space-y-3">
            <div>
              <h2 className="text-[18px] font-semibold tracking-[-0.02em]">Checklist de recebimentos</h2>
              <p className="text-[13px] text-[#586174]">Busca global por cliente, data ou local, independentemente do mês selecionado — com texto na busca, aparecem eventos de qualquer mês e status. {future.length} eventos futuros.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className={`${input} sm:max-w-md`} placeholder="Nome, data (dd/mm/aaaa) ou local" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar eventos" />
              <select className={`${input} sm:max-w-xs`} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar eventos">
                <option value="open">Ainda a receber</option>
                <option value="partial">Parciais</option>
                <option value="paid">Quitados</option>
                <option value="unchecked">A conferir (ficha)</option>
                <option value="all">Todos</option>
              </select>
            </div>
            {visible.length === 0 && <p className={`${box} text-center text-[14px] text-[#586174]`}>Nenhum evento encontrado{search ? ` para “${search}”` : " neste filtro"}.</p>}
            {visible.map((row) => {
              const [statusLabel, statusClass] = RECEIPT_STATUS[row.status] || RECEIPT_STATUS.pending;
              const history = eventHistory(row.event, row.sheet, data.ledger, data.settings);
              return (
                <article key={row.event.id} className={box}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[16px] font-semibold">{row.event_name}</h3>
                      <p className="text-[13px] text-[#586174]">{br(row.event_date)}{row.location_name ? ` • ${row.location_name}` : ""}{row.due_on ? ` • previsão ${br(row.due_on)}` : ""}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {row.checked ? <Pill className={statusClass}>{statusLabel}</Pill> : <Pill className="bg-amber-50 text-amber-800 ring-amber-600/20">Ficha a conferir</Pill>}
                      <Pill className="bg-[#f2f4f7] text-[#475467] ring-[#475467]/10">{row.past ? "Realizado" : "Futuro"}</Pill>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {[["Contratado", row.contract], ["Recebido", row.received], ["Falta receber", row.open, true], ["Custos", row.costs], ["Margem", row.margin]].map(([label, value, strong]) => (
                      <div key={label} className="rounded-[12px] bg-[#f6f7f9] px-3 py-2">
                        <p className="text-[11px] text-[#8b93a3]">{label}</p>
                        <strong className={`text-[14px] tabular-nums ${strong && value > 0 ? "text-emerald-700" : ""}`}>{!row.checked && ["Custos", "Margem"].includes(label) ? "Não conferido" : money(value)}</strong>
                      </div>
                    ))}
                  </div>
                  {row.overdue && <p className="mt-2 text-[13px] font-semibold text-red-700">Previsão de recebimento vencida.</p>}
                  <details className="mt-3 rounded-[14px] bg-[#f6f7f9] px-3 py-2">
                    <summary className="cursor-pointer text-[13px] font-semibold">Ver histórico ({history.length})</summary>
                    {history.length === 0 ? <p className="py-2 text-[13px] text-[#586174]">Nenhum lançamento registrado.</p> : history.map(historyRow)}
                  </details>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.open > 0 && <button disabled={!data.settings || busy} className={button} onClick={() => newMovement("receipt", row.event.id, "", (row.open / 100).toFixed(2).replace(".", ","))}>Registrar recebimento</button>}
                    <button className={ghost} onClick={() => openEvent(row.event)}>{row.checked ? "Ficha e custos" : "Conferir ficha"}</button>
                    <Link href={`/eventos/${row.event.id}`} className={ghost}>Abrir evento</Link>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {tab === "events" && draft && (
          <section className="space-y-4">
            <button className="text-[14px] font-semibold text-[#586174]" onClick={() => setDraft(null)}>← Voltar aos eventos</button>
            <div className={box}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{draft.event.client_name}</h2>
                  <p className="text-[14px] text-[#586174]">{br(draft.event.event_date)} • {draft.event.formation} • {draft.event.location_name}</p>
                </div>
                <Pill className={draft.status === "checked" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15" : "bg-amber-50 text-amber-800 ring-amber-600/20"}>{status(data.sheets.find((s) => s.event_id === draft.event.id)?.status)}</Pill>
              </div>
              <EventServices event={draft.event} />
              <Link className="my-3 inline-block text-[13px] font-semibold text-violet-700" href={`/eventos/${draft.event.id}`}>Abrir cadastro completo do evento</Link>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Valor contratado confirmado por você (R$)">
                  <MoneyInput key={`${draft.event.id}:${draft.revision}`} value={draft.contract_cents} onValue={(n) => setDraft((d) => ({ ...d, contract_cents: n }))} />
                </Field>
                <Field label="Data prevista para receber o saldo em aberto">
                  <input type="date" max={receiptDeadline(draft.event.event_date) || undefined} className={input} value={draft.expected_receipt_on || receiptDeadline(draft.event.event_date) || ""} onChange={(e) => setDraft((d) => ({ ...d, expected_receipt_on: e.target.value || null }))} />
                </Field>
              </div>
              <p className="mt-1 text-[12px] text-[#8b93a3]">Prazo padrão: dois dias antes do evento. Você pode antecipar essa previsão. As datas dos recebimentos realizados ficam preservadas.</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[["Recebido", current.received], ["A receber", current.open], ["Custos", current.total], ["Margem prevista", current.margin]].map(([label, value]) => (
                  <div key={label} className="rounded-[12px] bg-[#f6f7f9] px-3 py-2"><p className="text-[11px] text-[#8b93a3]">{label}</p><strong className="text-[14px] tabular-nums">{money(value)}</strong></div>
                ))}
              </div>
              {current.overpayment > 0 && <p className="mt-2 text-[13px] text-red-700">Recebido acima do contrato: {money(current.overpayment)}. Confira os lançamentos.</p>}
              <div className="mt-4 rounded-[16px] border border-[#e4e7ec] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[14px] font-semibold">Histórico deste evento</h3>
                  <button disabled={!data.settings || busy} className="text-[13px] font-semibold text-violet-700" onClick={() => newMovement("receipt", draft.event.id)}>+ Registrar recebimento</button>
                </div>
                <p className="text-[12px] text-[#8b93a3]">Para corrigir um valor, estorne o lançamento e registre o correto. Para duplicatas, estorne apenas a cópia.</p>
                {draftHistory.length === 0 ? <p className="py-2 text-[13px] text-[#586174]">Nenhum lançamento registrado.</p> : draftHistory.map(historyRow)}
              </div>
            </div>
            <div>
              <h3 className="text-[18px] font-semibold tracking-[-0.02em]">Músicos e outros custos</h3>
              <p className="text-[13px] text-[#586174]">Cachês sugeridos são editáveis. Salve a ficha antes de registrar pagamentos. Depois da data do evento, os custos contam como pagos automaticamente; registre pagamento só quando quiser detalhar um adiantamento ou valor diferente.</p>
            </div>
            {draft.costs.map((c, i) => {
              if (c.excluded) return null;
              const calculated = current.costs.find((x) => x.id === c.id);
              return (
                <div key={c.id} className={`${box} grid items-end gap-3 sm:grid-cols-3`}>
                  <Field label="Descrição"><input className={input} value={c.description} onChange={(e) => costEdit(i, { description: e.target.value })} /></Field>
                  <Field label="Categoria livre"><input list="categories" className={input} value={c.category} onChange={(e) => costEdit(i, { category: e.target.value })} /></Field>
                  <Field label={`Valor do evento (R$)${c.category === "musician" ? ` • Padrão: ${money(c.default_cents)}` : ""}`}>
                    <MoneyInput key={`${c.id}:${draft.revision}`} value={c.amount_cents} onValue={(n) => costEdit(i, { amount_cents: n })} />
                  </Field>
                  <Field label="Pagar até (padrão: data do evento)"><input type="date" className={input} value={c.due_on || draft.event.event_date || ""} onChange={(e) => costEdit(i, { due_on: e.target.value || null })} /></Field>
                  <Field label="Status do acordo">
                    <select className={input} value={c.status} onChange={(e) => costEdit(i, { status: e.target.value })}>
                      <option value="predicted">Previsto</option>
                      <option value="confirmed">Confirmado</option>
                    </select>
                  </Field>
                  <Field label="Observação"><input className={input} value={c.notes || ""} onChange={(e) => costEdit(i, { notes: e.target.value })} /></Field>
                  <div className="text-[13px]">
                    <p className="text-[#586174]">Pago: {money(calculated.paid)} • Saldo: {money(calculated.open)}</p>
                    <strong>{draft.event.event_date < today() ? "Realizado (considerado pago)" : calculated.paid >= c.amount_cents && c.amount_cents > 0 ? "Pago" : calculated.paid > 0 ? "Pago parcialmente" : c.status === "confirmed" ? "Confirmado" : "Previsto"}</strong>
                  </div>
                  <div className="flex flex-wrap gap-3 sm:col-span-3">
                    <button disabled={busy || !data.settings || !data.sheets.find((s) => s.event_id === draft.event.id)?.costs.some((x) => x.id === c.id)} className={ghost} onClick={() => newMovement("payment", draft.event.id, c.id)}>Registrar pagamento</button>
                    {c.musician_id && <button disabled={busy} className="text-[13px] font-semibold text-violet-700" onClick={() => run({ action: "default", key: `musician:${c.musician_id}`, amount_cents: c.amount_cents })}>Atualizar também o padrão</button>}
                    <button disabled={calculated.paid > 0} className="text-[13px] font-semibold text-[#586174] disabled:opacity-40" onClick={() => setDraft((d) => ({ ...d, costs: d.costs.map((x) => (x.id === c.id ? excludeCost(x) : x)) }))}>Remover custo</button>
                  </div>
                </div>
              );
            })}
            {draft.costs.some((c) => c.excluded) && (
              <details className={`${box} text-[13px]`}>
                <summary className="cursor-pointer font-semibold">Custos removidos deste evento ({draft.costs.filter((c) => c.excluded).length})</summary>
                <p className="mt-2 text-[#586174]">Não entram nos custos nem são recriados automaticamente. A alteração fica registrada ao salvar.</p>
                {draft.costs.filter((c) => c.excluded).map((c) => (
                  <div key={c.id} className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span>{c.description}</span>
                    <button className="font-semibold text-violet-700" onClick={() => setDraft((d) => ({ ...d, costs: d.costs.map((x) => (x.id === c.id ? restoreCost(x) : x)) }))}>Restaurar custo</button>
                  </div>
                ))}
              </details>
            )}
            <datalist id="categories">
              {["musician", "sonorização", "transporte", "operacional", "hospedagem", "alimentação", "outros"].map((x) => <option key={x}>{x}</option>)}
            </datalist>
            <button className={ghost} onClick={() => setDraft((d) => ({ ...d, costs: [...d.costs, { id: crypto.randomUUID(), description: "", category: "outros", status: "predicted", amount_cents: 0, notes: "" }] }))}>+ Outro custo</button>
            <div className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+76px)] z-[40] flex flex-wrap gap-2 rounded-[20px] border border-[#e4e7ec] bg-white/95 p-3 shadow-[0_8px_24px_rgba(16,24,40,0.08)] backdrop-blur md:bottom-3">
              <button disabled={busy} className={ghost} onClick={() => saveEvent(false, false)}>Salvar em conferência</button>
              <button disabled={busy} className={button} onClick={() => saveEvent()}>Salvar como CONFERIDO</button>
              <button disabled={busy} className={ghost} onClick={() => saveEvent(true)}>Salvar e próximo evento</button>
            </div>
          </section>
        )}

        {tab === "history" && (
          <section className={box}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-semibold tracking-[-0.02em]">Histórico de movimentos</h2>
                <p className="text-[13px] text-[#586174]">Para editar um lançamento, estorne com motivo e registre o valor correto. O original fica preservado.</p>
              </div>
              <select className={`${input} sm:max-w-xs`} value={historyKind} onChange={(e) => setHistoryKind(e.target.value)} aria-label="Tipo de lançamento">
                <option value="all">Todos os lançamentos</option>
                <option value="receipt">Recebimentos</option>
                <option value="withdrawal">Retiradas</option>
                <option value="payment">Pagamentos de custos</option>
                <option value="realized_cost">Cachês realizados</option>
                <option value="adjustment">Ajustes de conciliação</option>
                <option value="reversal">Estornos</option>
              </select>
            </div>
            <div className="mt-3">
              {data.settings && historyKind === "all" && (
                <div className="flex flex-wrap justify-between gap-3 border-b border-[#eceef2] pb-3 text-[13px]">
                  <span><strong>Marco zero</strong> • {br(data.settings.opening_on)}</span>
                  <strong>{money(data.settings.opening_cents)}</strong>
                </div>
              )}
              {fullHistory.length === 0 ? <p className="py-6 text-center text-[14px] text-[#586174]">Nenhum lançamento.</p> : fullHistory.map(historyRow)}
            </div>
          </section>
        )}

        {tab === "musicians" && (
          <section className="space-y-3">
            <Stat label="Total a pagar aos músicos (eventos futuros conferidos)" value={stats.musician} hint="Eventos já realizados contam como pagos automaticamente." />
            {debt.length === 0 && <p className={`${box} text-center text-[14px] text-[#586174]`}>Nenhum cachê futuro em aberto.</p>}
            {debt.map((d) => (
              <div key={d.key} className={box}>
                <button className="w-full text-left" onClick={() => setMusician(musician === d.key ? "" : d.key)}>
                  <strong>{d.name}</strong>
                  <p className="text-[13px] text-[#586174]">{new Set(d.events.map((x) => x.event.id)).size} eventos • Previsto/confirmado: {money(d.total)} • Pago: {money(d.paid)} • A pagar: {money(d.open)}</p>
                </button>
                {musician === d.key && d.events.map(({ event, cost }) => (
                  <button key={cost.id} className="mt-2 block text-[13px] font-semibold text-violet-700" onClick={() => openEvent(event)}>{event.client_name} • {br(event.event_date)} • {money(cost.open)}</button>
                ))}
              </div>
            ))}
          </section>
        )}

        {tab === "settings" && (
          <section className={box}>
            <h2 className="text-[18px] font-semibold tracking-[-0.02em]">Configurações do financeiro</h2>
            <p className="mt-1 text-[14px] text-[#586174]">
              Marco zero: {data.settings ? `${br(data.settings.opening_on)} • ${money(data.settings.opening_cents)}` : "Ainda não definido"}. Padrões são sugestões para custos novos, sem alterar acordos já salvos.
            </p>
            <form
              className="mt-4 flex flex-wrap items-end gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await run({ action: "default", key: defaultForm.key, amount_cents: cents(defaultForm.amount) });
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              <Field label="Músico, função ou custo padrão">
                <select required className={input} value={defaultForm.key} onChange={(e) => setDefaultForm({ ...defaultForm, key: e.target.value })}>
                  <option value="">Selecione</option>
                  <option value="general:musician">Cachê geral por músico</option>
                  <option value="cost:sonorização">Sonorização</option>
                  <option value="cost:transporte">Transporte / deslocamento</option>
                  <option value="cost:operacional">Operacional</option>
                  {[...new Map(data.musicians.map((m) => [`musician:${m.musician_id}`, m])).values()].filter((m) => m.musician_id).map((m) => (
                    <option key={m.musician_id} value={`musician:${m.musician_id}`}>{m.name}</option>
                  ))}
                  {[...new Set(data.musicians.map((m) => m.role).filter(Boolean))].map((r) => (
                    <option key={r} value={`role:${r}`}>Função: {r}</option>
                  ))}
                </select>
              </Field>
              <Field label="Valor padrão (R$)">
                <input required inputMode="decimal" className={input} value={defaultForm.amount} onChange={(e) => setDefaultForm({ ...defaultForm, amount: e.target.value })} />
              </Field>
              <button className={button} disabled={busy}>Salvar padrão</button>
            </form>
            <ul className="mt-4 divide-y divide-[#eceef2] text-[14px]">
              {data.defaults.map((d) => (
                <li key={d.key} className="flex justify-between gap-3 py-2">
                  <span className="text-[#586174]">
                    {d.key.startsWith("musician:")
                      ? data.musicians.find((m) => `musician:${m.musician_id}` === d.key)?.name || d.key
                      : d.key === "general:musician"
                        ? "Cachê geral por músico"
                        : d.key.replace("role:", "Função: ").replace("cost:", "Custo: ")}
                  </span>
                  <strong>{money(d.amount_cents)}</strong>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {reconcile && (() => {
        // Saldo do sistema na data da conferência (lançamentos até essa data), para não dobrar
        // movimentos posteriores dentro do ajuste.
        const balanceAt = (date) => cashPositionAt(data.events, data.sheets, data.ledger, data.settings, date).cash;
        const systemBalance = balanceAt(reconcile.occurred_on);
        const realCentsOf = (value) => { try { return String(value).trim() ? cents(value) : null; } catch { return null; } };
        const realCents = realCentsOf(reconcile.real);
        const diff = realCents === null ? null : realCents - systemBalance;
        const withCalculated = (next) => {
          const real = realCentsOf(next.real);
          if (real === null) return next;
          const delta = real - balanceAt(next.occurred_on);
          return delta === 0 ? { ...next, amount: "" } : { ...next, kind: delta > 0 ? "adjustment_in" : "adjustment_out", amount: (Math.abs(delta) / 100).toFixed(2).replace(".", ",") };
        };
        return (
          <Modal title="Ajuste de conciliação" subtitle="Corrige o caixa para o saldo real conferido. Não é retirada, não é custo e não altera a margem." onClose={() => setReconcile(null)}>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                try {
                  const amount = cents(reconcile.amount);
                  if (amount <= 0) throw new Error("Informe um valor de ajuste maior que zero.");
                  const next = await run({ action: "movement", kind: reconcile.kind, amount_cents: amount, occurred_on: reconcile.occurred_on, notes: reconcile.notes.trim(), method: "conciliação", event_id: null, in_opening: false, request_id: reconcile.request_id });
                  if (next) setReconcile(null);
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              <div className="rounded-[14px] bg-[#f6f7f9] p-3 text-[13px] sm:col-span-2">
                <div className="flex justify-between"><span className="text-[#586174]">Caixa no sistema em {br(reconcile.occurred_on)}</span><strong><Amount value={systemBalance} /></strong></div>
                {diff !== null && <div className="mt-1 flex justify-between"><span className="text-[#586174]">Diferença para o saldo conferido</span><strong><Amount value={diff} /></strong></div>}
                {diff === 0 && <p className="mt-1 font-semibold text-emerald-700">Saldos conferem: nenhum ajuste necessário.</p>}
              </div>
              <Field label="Saldo real conferido (opcional, calcula o ajuste)">
                <input
                  inputMode="decimal"
                  className={input}
                  value={reconcile.real}
                  onChange={(e) => setReconcile(withCalculated({ ...reconcile, real: e.target.value }))}
                  placeholder="Ex.: 1.196,08"
                />
              </Field>
              <Field label="Tipo do ajuste">
                <select className={input} value={reconcile.kind} onChange={(e) => setReconcile({ ...reconcile, kind: e.target.value })}>
                  <option value="adjustment_out">Reduzir o caixa (−)</option>
                  <option value="adjustment_in">Aumentar o caixa (+)</option>
                </select>
              </Field>
              <Field label="Valor do ajuste (R$)">
                <input required inputMode="decimal" className={input} value={reconcile.amount} onChange={(e) => setReconcile({ ...reconcile, amount: e.target.value })} />
              </Field>
              <Field label="Data da conferência">
                <input required type="date" min={data.settings?.opening_on} max={today()} className={input} value={reconcile.occurred_on} onChange={(e) => { if (e.target.value) setReconcile(withCalculated({ ...reconcile, occurred_on: e.target.value })); }} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Motivo (obrigatório)">
                  <textarea required rows={3} maxLength={500} className={input} value={reconcile.notes} onChange={(e) => setReconcile({ ...reconcile, notes: e.target.value })} placeholder="Ex.: conferência com extrato bancário de 19/10 — diferença residual após reconstrução do caixa" />
                </Field>
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button disabled={busy || !reconcile.notes.trim() || !reconcile.amount.trim() || diff === 0} className={button}>Registrar ajuste</button>
                <button type="button" className={ghost} onClick={() => setReconcile(null)}>Cancelar</button>
              </div>
            </form>
          </Modal>
        );
      })()}

      {movement && (
        <Modal
          title={movement.kind === "receipt" ? "Registrar recebimento" : movement.kind === "payment" ? "Pagar custo / cachê" : "Registrar retirada"}
          subtitle={movement.kind === "withdrawal" ? "Reduz o caixa e a projeção, sem virar custo dos eventos." : movement.kind === "receipt" ? "Aumenta o caixa e reduz o saldo a receber do evento." : "Registra um pagamento detalhado deste custo."}
          onClose={() => setMovement(null)}
        >
          <form onSubmit={saveMovement} className="grid gap-3 sm:grid-cols-2">
            {movement.kind !== "withdrawal" && (
              <div className="space-y-2 sm:col-span-2">
                <Field label="Buscar evento por nome, data ou local">
                  <input className={input} placeholder="Ex.: Mariana, 13/12/2026, Solar" value={movementSearch} onChange={(e) => setMovementSearch(e.target.value)} disabled={movement.kind === "payment"} />
                </Field>
                <select required className={input} value={movement.event_id} disabled={movement.kind === "payment"} onChange={(e) => setMovement({ ...movement, event_id: e.target.value })} aria-label="Evento">
                  <option value="">Selecione o evento</option>
                  {movementEvents.map((e) => <option key={e.id} value={e.id}>{e.client_name} — {br(e.event_date)}</option>)}
                </select>
              </div>
            )}
            <Field label="Valor (R$)">
              <input required autoFocus inputMode="decimal" className={input} value={movement.amount} onChange={(e) => setMovement({ ...movement, amount: e.target.value })} />
            </Field>
            <Field label="Data do recebimento / pagamento">
              <input required type="date" max={today()} className={input} value={movement.occurred_on} onChange={(e) => setMovement({ ...movement, occurred_on: e.target.value })} />
            </Field>
            <Field label="Forma">
              <select className={input} value={movement.method} onChange={(e) => setMovement({ ...movement, method: e.target.value })}>
                {["Pix", "transferência", "dinheiro", "outro"].map((x) => <option key={x}>{x}</option>)}
              </select>
            </Field>
            {movement.kind === "receipt" && (
              <>
                <Field label="Origem">
                  <select className={input} value={movement.origin} onChange={(e) => setMovement({ ...movement, origin: e.target.value })}>
                    {["WhatsApp", "painel do cliente", "lançamento manual", "outro"].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </Field>
                <Field label="Comprovante opcional (link HTTPS)">
                  <input type="url" className={input} value={movement.proof_reference} onChange={(e) => setMovement({ ...movement, proof_reference: e.target.value })} />
                </Field>
              </>
            )}
            {movement.kind === "withdrawal" && (
              <>
                <Field label="Tipo">
                  <select className={input} value={movement.category} onChange={(e) => setMovement({ ...movement, category: e.target.value })}>
                    {["Empréstimo", "Distribuição/Lucro", "Pró-labore", "Outros"].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </Field>
                <Field label="Destino">
                  <input required className={input} value={movement.destination} onChange={(e) => setMovement({ ...movement, destination: e.target.value })} />
                </Field>
              </>
            )}
            <Field label="Observação opcional">
              <input className={input} value={movement.notes} onChange={(e) => setMovement({ ...movement, notes: e.target.value })} />
            </Field>
            <label className="flex items-start gap-2 rounded-[14px] bg-[#f6f7f9] p-3 text-[13px] text-[#586174] sm:col-span-2">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={movement.in_opening} onChange={(e) => setMovement({ ...movement, in_opening: e.target.checked })} />
              <span>Este valor já está refletido no saldo inicial (conferência histórica; não movimenta o caixa novamente).</span>
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button disabled={busy} className={button}>{movement.kind === "receipt" ? "Salvar e atualizar caixa" : "Salvar"}</button>
              <button type="button" className={ghost} onClick={() => setMovement(null)}>Cancelar</button>
            </div>
          </form>
        </Modal>
      )}
    </AdminShell>
  );
}
