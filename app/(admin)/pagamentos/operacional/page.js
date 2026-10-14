"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
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
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900";
const button =
  "rounded-xl bg-violet-700 px-4 py-2 font-semibold text-white disabled:opacity-50";
const box = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";
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
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
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
    <label className="block space-y-1 text-sm font-semibold">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Metric({ label, value, strong }) {
  return (
    <div
      className={`${box} min-w-0 ${strong ? "border-violet-400 bg-violet-50" : ""}`}
    >
      <div className="text-sm text-slate-600">{label}</div>
      <div
        className={`mt-2 break-words text-2xl font-bold ${value < 0 ? "text-red-700" : "text-slate-900"}`}
      >
        {money(value)}
      </div>
    </div>
  );
}
export default function Page() {
  return (
    <ProtectedRoute requiredRole="admin">
      <Finance />
    </ProtectedRoute>
  );
}
function Finance() {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [data, setData] = useState(null),
    [tab, setTab] = useState("cash"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [draft, setDraft] = useState(null),
    [movement, setMovement] = useState(null),
    [musician, setMusician] = useState("");
  const [opening, setOpening] = useState({ opening_on: today(), amount: "" }),
    [defaultForm, setDefaultForm] = useState({ key: "", amount: "" });
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
        body: JSON.stringify({
          ...command,
          request_id: command.request_id || crypto.randomUUID(),
        }),
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
  const stats = useMemo(
    () =>
      data
        ? dashboard(data.events, data.sheets, data.ledger, data.settings)
        : null,
    [data],
  );
  const planning = useMemo(
    () =>
      data ? monthlyCommitments(data.events, data.sheets, data.ledger) : null,
    [data],
  );
  const monthLabel = (value) =>
    new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${value}-01T12:00:00Z`));
  const period = planning?.months.find((row) => row.month === month) || {
    month,
    musician: 0,
    other: 0,
    total: 0,
    receivable: 0,
    receipts: [],
    unchecked: 0,
    items: [],
  };
  const monthlyResult = period.receivable - period.total;
  const accumulatedResult = planning
    ? planning.months.reduce((sum, row) => sum + row.receivable - row.total, 0)
    : 0;
  const accumulatedCash = stats
    ? stats.cash + accumulatedResult - (planning?.arrearsTotal || 0)
    : 0;
  const relevant = useMemo(
    () =>
      data
        ? data.events
            .filter(
              (e) =>
                data.sheets.some((s) => s.event_id === e.id) ||
                (e.event_date >= today() &&
                  !["cancelado", "cancelled", "canceled"].includes(
                    String(e.status).toLowerCase(),
                  )),
            )
            .sort((a, b) => a.event_date.localeCompare(b.event_date))
        : [],
    [data],
  );
  const future = relevant.filter((e) => e.event_date >= today());
  const visible = relevant.filter((e) => {
    const sheet = data.sheets.find((s) => s.event_id === e.id);
    const term =
      `${e.client_name} ${e.event_date} ${e.event_date?.split("-").reverse().join("/")} ${e.location_name}`.toLowerCase();
    return (
      term.includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "checked" && sheet?.status === "checked") ||
        (filter === "unchecked" && sheet?.status !== "checked"))
    );
  });
  function openEvent(e, source = data) {
    const saved = source.sheets.find((s) => s.event_id === e.id);
    const costs = suggestedCosts(
      e,
      saved?.costs,
      source.musicians,
      source.defaults,
      () => crypto.randomUUID(),
    );
    setDraft({
      event: e,
      revision: saved?.revision || 0,
      contract_cents:
        saved?.contract_cents ?? Math.round(Number(e.agreed_amount || 0) * 100),
      costs,
      expected_receipt_on: expectedReceiptDate(e, saved),
      status: saved?.status || "draft",
    });
    setTab("events");
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
      const e = future
        .slice(i + 1)
        .find(
          (e) =>
            d.sheets.find((s) => s.event_id === e.id)?.status !== "checked",
        );
      if (e) openEvent(e, d);
      else {
        setDraft(null);
        setNotice("Conferência concluída para os próximos eventos.");
      }
    } else openEvent(draft.event, d);
  }
  function newMovement(kind, event_id = "", cost_id = "") {
    setMovement({
      kind,
      event_id,
      cost_id,
      amount: "",
      occurred_on: today(),
      method: "Pix",
      origin: "WhatsApp",
      destination: "",
      notes: "",
      proof_reference: "",
      in_opening: false,
      request_id: crypto.randomUUID(),
    });
  }
  async function saveMovement(event) {
    event.preventDefault();
    try {
      const next = await run({
        ...movement,
        action: "movement",
        amount_cents: cents(movement.amount),
        event_id: movement.event_id || null,
      });
      if (next) setMovement(null);
    } catch (e) {
      setError(e.message);
    }
  }
  function costEdit(index, patch) {
    setDraft((d) => ({
      ...d,
      costs: d.costs.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }
  const debt = useMemo(() => {
    if (!data) return [];
    const map = new Map();
    for (const e of relevant) {
      const s = eventSummary(
        e,
        data.sheets.find((s) => s.event_id === e.id),
        data.ledger,
      );
      if (!s.checked) continue;
      for (const c of s.costs.filter((c) => c.category === "musician")) {
        const key = c.musician_id || c.description;
        const row = map.get(key) || {
          key,
          name: c.description,
          total: 0,
          paid: 0,
          open: 0,
          events: [],
        };
        row.total += c.amount_cents;
        row.paid += c.paid;
        row.open += c.open;
        row.events.push({ event: e, cost: c });
        map.set(key, row);
      }
    }
    return [...map.values()];
  }, [data, relevant]);
  if (!data)
    return (
      <AdminShell>
        <p role="alert">{error || "Carregando financeiro operacional..."}</p>
        <button
          className={button}
          onClick={() => load().catch((e) => setError(e.message))}
        >
          Tentar novamente
        </button>
      </AdminShell>
    );
  const current = draft
    ? eventSummary(
        draft.event,
        { ...draft, event_id: draft.event.id },
        data.ledger,
      )
    : null;
  const activeIds = new Set(activeEntries(data.ledger).map((x) => x.id));
  const history = data.ledger
    .filter((x) => !draft || x.event_id === draft.event.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <AdminShell>
      <main className="space-y-5 text-slate-900">
        <div>
          <h1 className="text-3xl font-bold">Financeiro operacional</h1>
          <p className="mt-2 text-slate-600">
            Marco zero próprio • Conferência manual dos eventos • Histórico
            preservado
          </p>
        </div>
        <nav className="flex flex-wrap gap-2">
          <Link className="rounded-xl border px-4 py-2" href="/pagamentos">
            Pagamentos / Legado
          </Link>
          {[
            ["cash", "Caixa & Compromissos"],
            ["events", "Eventos"],
            ["musicians", "Músicos a pagar"],
            ["settings", "Configurações"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? button : "rounded-xl border px-4 py-2"}
              onClick={() => {
                setTab(key);
                setDraft(null);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-xl bg-emerald-50 p-3 text-emerald-800"
          >
            {notice}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            disabled={!data.settings || busy}
            className={button}
            onClick={() => newMovement("receipt", draft?.event.id)}
          >
            + Registrar recebimento
          </button>
          <button
            disabled={!data.settings || busy}
            className={button}
            onClick={() => newMovement("withdrawal")}
          >
            + Registrar retirada
          </button>
          <button
            className="rounded-xl border px-4 py-2"
            onClick={() => load().catch((e) => setError(e.message))}
          >
            Atualizar
          </button>
        </div>
        {!data.settings && (
          <section className={box}>
            <h2 className="text-xl font-bold">Defina o marco zero</h2>
            <p className="my-3">
              Informe quanto do dinheiro atual pertence à Harmonics.
              Recebimentos e pagamentos já incluídos nesse saldo devem ser
              marcados como históricos. O marco zero fica preservado após
              salvar.
            </p>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await run({
                    action: "opening",
                    opening_on: opening.opening_on,
                    opening_cents: cents(opening.amount),
                  });
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              <Field label="Saldo inicial (R$)">
                <input
                  required
                  className={input}
                  inputMode="decimal"
                  value={opening.amount}
                  onChange={(e) =>
                    setOpening({ ...opening, amount: e.target.value })
                  }
                />
              </Field>
              <Field label="Data do marco zero">
                <input
                  required
                  type="date"
                  max={today()}
                  className={input}
                  value={opening.opening_on}
                  onChange={(e) =>
                    setOpening({ ...opening, opening_on: e.target.value })
                  }
                />
              </Field>
              <button disabled={busy} className={button}>
                Definir marco zero
              </button>
            </form>
          </section>
        )}
        {movement && (
          <section className={`${box} border-violet-400`}>
            <h2 className="text-xl font-bold">
              {movement.kind === "receipt"
                ? "Registrar recebimento"
                : movement.kind === "payment"
                  ? "Pagar custo / cachê"
                  : "Registrar retirada"}
            </h2>
            <form
              onSubmit={saveMovement}
              className="mt-3 grid gap-3 sm:grid-cols-2"
            >
              {movement.kind !== "withdrawal" && (
                <Field label="Buscar evento por nome, data ou local">
                  <input
                    className={input}
                    placeholder="Mariana"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <select
                    required
                    className={input}
                    value={movement.event_id}
                    disabled={movement.kind === "payment"}
                    onChange={(e) =>
                      setMovement({ ...movement, event_id: e.target.value })
                    }
                  >
                    <option value="">Selecione o evento</option>
                    {relevant
                      .filter(
                        (e) =>
                          e.id === movement.event_id ||
                          `${e.client_name} ${e.event_date} ${e.event_date?.split("-").reverse().join("/")} ${e.location_name}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                      )
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.client_name} — {e.event_date}
                        </option>
                      ))}
                  </select>
                </Field>
              )}
              <Field label="Valor (R$)">
                <input
                  required
                  autoFocus
                  inputMode="decimal"
                  className={input}
                  value={movement.amount}
                  onChange={(e) =>
                    setMovement({ ...movement, amount: e.target.value })
                  }
                />
              </Field>
              <Field label="Data do recebimento / pagamento">
                <input
                  required
                  type="date"
                  max={today()}
                  className={input}
                  value={movement.occurred_on}
                  onChange={(e) =>
                    setMovement({ ...movement, occurred_on: e.target.value })
                  }
                />
              </Field>
              <Field label="Forma">
                <select
                  className={input}
                  value={movement.method}
                  onChange={(e) =>
                    setMovement({ ...movement, method: e.target.value })
                  }
                >
                  {["Pix", "transferência", "dinheiro", "outro"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              {movement.kind === "receipt" && (
                <>
                  <Field label="Origem">
                    <select
                      className={input}
                      value={movement.origin}
                      onChange={(e) =>
                        setMovement({ ...movement, origin: e.target.value })
                      }
                    >
                      {[
                        "WhatsApp",
                        "painel do cliente",
                        "lançamento manual",
                        "outro",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Comprovante opcional (link HTTPS)">
                    <input
                      type="url"
                      className={input}
                      value={movement.proof_reference}
                      onChange={(e) =>
                        setMovement({
                          ...movement,
                          proof_reference: e.target.value,
                        })
                      }
                    />
                  </Field>
                </>
              )}
              {movement.kind === "withdrawal" && (
                <Field label="Destino">
                  <input
                    required
                    className={input}
                    value={movement.destination}
                    onChange={(e) =>
                      setMovement({ ...movement, destination: e.target.value })
                    }
                  />
                </Field>
              )}
              <Field label="Observação opcional">
                <input
                  className={input}
                  value={movement.notes}
                  onChange={(e) =>
                    setMovement({ ...movement, notes: e.target.value })
                  }
                />
              </Field>
              <label className="sm:col-span-2">
                <input
                  type="checkbox"
                  checked={movement.in_opening}
                  onChange={(e) =>
                    setMovement({ ...movement, in_opening: e.target.checked })
                  }
                />{" "}
                Este valor já está refletido no saldo inicial (conferência
                histórica; não movimenta o caixa novamente).
              </label>
              <div className="flex gap-2">
                <button disabled={busy} className={button}>
                  Salvar
                </button>
                <button type="button" onClick={() => setMovement(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        )}
        {tab === "cash" && (
          <>
            <p className="rounded-xl bg-amber-50 p-4">
              {stats.unchecked} eventos futuros ainda não conferidos.
              Compromissos, margem e posição projetada consideram somente fichas
              conferidas; a posição é parcial enquanto a conferência não
              terminar. Movimentos reais já registrados sempre afetam o caixa.
            </p>
            <section className={`${box} space-y-4`}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">
                    Entradas e pagamentos por mês
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Cada mês mostra suas próprias entradas e pagamentos previstos.
                    O saldo dos meses anteriores aparece somente no total final.
                  </p>
                </div>
                <Field label="Mês de referência">
                  <input
                    type="month"
                    min={today().slice(0, 7)}
                    className={input}
                    value={month}
                    onChange={(e) => {
                      if (e.target.value) setMonth(e.target.value);
                    }}
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Metric label="Caixa atual" value={stats.cash} />
                <Metric label="Entradas previstas neste mês" value={period.receivable} />
                <Metric label="Resultado previsto deste mês" value={monthlyResult} strong />
                <Metric
                  label={`Músicos a pagar em ${monthLabel(month)}`}
                  value={period.musician}
                />
                <Metric label="Outros custos no mês" value={period.other} />
                <Metric label="Total a pagar no mês" value={period.total} />
              </div>
              <p className="rounded-xl bg-slate-50 p-3 text-sm">
                Em {monthLabel(month)}, as entradas previstas menos os pagamentos previstos resultam em {money(monthlyResult)}.
                Esse resultado considera apenas este mês, sem somar o caixa atual nem os meses anteriores.
                É uma projeção do fluxo de caixa pendente, não o lucro total dos contratos.{" "}
                {period.unchecked > 0
                  ? `${period.unchecked} eventos deste mês ainda aguardam conferência.`
                  : ""}
              </p>
              {planning.arrearsTotal > 0 && (
                <p className="text-sm font-semibold text-red-700">
                  Compromissos de meses anteriores ainda em aberto:{" "}
                  {money(planning.arrearsTotal)}. Incluídos na necessidade
                  acumulada.
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2">Mês</th>
                      <th className="p-2">Músicos</th>
                      <th className="p-2">Outros custos</th>
                      <th className="p-2">A receber no mês</th>
                      <th className="p-2">A pagar no mês</th>
                      <th className="p-2">Resultado previsto do mês</th>
                      <th className="p-2">Eventos a conferir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planning.months.map((row) => (
                      <tr
                        key={row.month}
                        className={`border-b ${row.month === month ? "bg-violet-50" : ""}`}
                      >
                        <td className="p-2">
                          <button
                            className="font-semibold text-violet-700"
                            onClick={() => setMonth(row.month)}
                          >
                            {monthLabel(row.month)}
                          </button>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {money(row.musician)}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {money(row.other)}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {money(row.receivable)}
                        </td>
                        <td className="p-2 whitespace-nowrap font-semibold">
                          {money(row.total)}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <span
                            className={
                              row.receivable - row.total < 0
                                ? "text-red-700"
                                : "text-emerald-700"
                            }
                          >
                            {money(row.receivable - row.total)}
                          </span>
                        </td>
                        <td className="p-2">{row.unchecked || "Conferidos"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-slate-50 font-semibold">
                      <td colSpan={5} className="p-3">Resultado acumulado dos meses exibidos</td>
                      <td className="p-3 whitespace-nowrap">{money(accumulatedResult)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="rounded-xl bg-slate-50 p-3 text-sm">
                <strong>Saldo de caixa projetado ao final de todos os meses: {money(accumulatedCash)}.</strong>{" "}
                Caixa atual + resultado acumulado − compromissos de meses anteriores ainda em aberto.
              </p>
              <h3 className="font-semibold">
                Recebimentos previstos em {monthLabel(month)}
              </h3>
              <p className="text-sm text-slate-600">
                Saldos ainda em aberto das fichas conferidas. Sem data manual, a
                previsão usa dois dias antes do evento.
              </p>
              {period.receipts.length === 0 && (
                <p className="text-sm text-slate-600">
                  Nenhum recebimento pendente previsto neste mês.
                </p>
              )}
              {period.receipts.map((item) => (
                <button
                  key={item.event_id}
                  className="flex w-full flex-wrap justify-between gap-2 rounded-xl border p-3 text-left"
                  onClick={() => {
                    const event = data.events.find(
                      (e) => e.id === item.event_id,
                    );
                    if (event) openEvent(event);
                  }}
                >
                  <div>
                    <strong>
                      {item.due_on.split("-").reverse().join("/")} •{" "}
                      {item.event_name}
                    </strong>
                    <p className="text-sm text-slate-600">
                      {item.date_source === "manual"
                        ? "Previsão definida por você"
                        : "Dois dias antes do evento"}
                      {item.overdue ? " • Data prevista já passou" : ""}
                    </p>
                  </div>
                  <strong className="text-emerald-700">
                    {money(item.amount)}
                  </strong>
                </button>
              ))}
              {planning.overdueReceipts.length > 0 && (
                <div className="rounded-xl bg-amber-50 p-3 text-sm">
                  <strong>
                    Recebimentos anteriores ou sem data: reprogramar previsão
                  </strong>
                  <p>
                    Estes saldos permanecem a receber, mas não entram
                    automaticamente na projeção de um mês futuro.
                  </p>
                  {planning.overdueReceipts.map((item) => (
                    <button
                      key={item.event_id}
                      className="mt-2 block text-violet-700"
                      onClick={() => {
                        const event = data.events.find(
                          (e) => e.id === item.event_id,
                        );
                        if (event) openEvent(event);
                      }}
                    >
                      {item.event_name} • {money(item.amount)} • Ajustar data
                      prevista
                    </button>
                  ))}
                </div>
              )}
              <h3 className="font-semibold">
                Obrigações por data em {monthLabel(month)}
              </h3>
              {period.items.length === 0 && (
                <p className="text-sm text-slate-600">
                  Nenhum custo pendente de ficha conferida neste mês.
                </p>
              )}
              {[...planning.arrears, ...period.items].map((item) => (
                <button
                  key={`${item.event_id}:${item.cost_id}`}
                  className="flex w-full flex-wrap justify-between gap-2 rounded-xl border p-3 text-left"
                  onClick={() => {
                    const event = data.events.find(
                      (e) => e.id === item.event_id,
                    );
                    if (event) openEvent(event);
                  }}
                >
                  <div>
                    <strong>
                      {item.due_on.split("-").reverse().join("/")} •{" "}
                      {item.event_name}
                    </strong>
                    <p className="text-sm text-slate-600">
                      {item.description} •{" "}
                      {item.date_source === "manual"
                        ? "Data definida por você"
                        : item.date_source === "event"
                          ? "Data do evento — ajustável"
                          : "Data a definir"}
                      {item.overdue ? " • Em atraso" : ""}
                    </p>
                  </div>
                  <strong>{money(item.amount)}</strong>
                </button>
              ))}
            </section>
            <h2 className="text-xl font-bold">
              Reserva para todos os eventos conferidos
            </h2>
            <p className="text-sm text-slate-600">
              Esta visão considera todos os meses. O planejamento acima mostra
              quando cada obrigação precisa ser paga.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[
                ["Caixa atual", stats.cash],
                ["Músicos — todos os meses", stats.musician],
                ["Outros custos — todos os meses", stats.other],
                ["Reserva total — todos os meses", stats.committed],
                ["Saldo após reservar todos os eventos", stats.free, true],
                ["A receber (contratos conferidos)", stats.receivable],
                ["Margem dos contratos futuros conferidos", stats.margin],
                [
                  "Posição projetada após todos os compromissos",
                  stats.projected,
                  true,
                ],
              ].map(([label, value, strong]) => (
                <Metric key={label} {...{ label, value, strong }} />
              ))}
            </div>
            <p className={box}>
              {stats.free < 0
                ? stats.projected >= 0
                  ? `Para reservar todos os eventos, faltam ${money(-stats.free)} no caixa atual. Os recebimentos conferidos cobrem esse déficit, sem garantia de prazo.`
                  : `Mesmo com os recebimentos conferidos, falta ${money(-stats.projected)}.`
                : `Saldo após reservar todos os eventos: ${money(stats.free)}.`}{" "}
              A margem futura é informativa e não é somada novamente à posição
              projetada.
            </p>
          </>
        )}
        {tab === "events" && !draft && (
          <>
            <div className="flex flex-wrap gap-3">
              <input
                className={`${input} max-w-md`}
                placeholder="Buscar noivos, data ou local"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className={`${input} max-w-xs`}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">Todos os eventos relevantes</option>
                <option value="unchecked">
                  Não conferidos / em conferência
                </option>
                <option value="checked">Conferidos</option>
              </select>
            </div>
            <p>
              {future.length} eventos futuros. Eventos conferidos anteriores
              permanecem para preservar compromissos.
            </p>
            <div className="space-y-3">
              {visible.map((e) => {
                const sheet = data.sheets.find((s) => s.event_id === e.id),
                  s = eventSummary(e, sheet, data.ledger);
                return (
                  <button
                    key={e.id}
                    onClick={() => openEvent(e)}
                    className={`${box} w-full text-left`}
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <strong>
                        {e.client_name} •{" "}
                        {e.event_date.split("-").reverse().join("/")}
                      </strong>
                      <span
                        className={
                          s.checked ? "text-emerald-700" : "text-amber-700"
                        }
                      >
                        {status(sheet?.status)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      {e.location_name} • {e.formation}
                    </p>
                    <EventServices event={e} compact />
                    <div className="mt-3 grid gap-2 sm:grid-cols-5">
                      {[
                        ["Contrato", s.contract],
                        ["Recebido", s.received],
                        ["A receber", s.open],
                        ["Custos", s.total],
                        ["Margem", s.margin],
                      ].map(([l, v]) => (
                        <div key={l}>
                          {l}
                          <br />
                          <strong>
                            {!s.checked && ["Custos", "Margem"].includes(l)
                              ? "Não conferido"
                              : money(v)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {tab === "events" && draft && (
          <section className="space-y-4">
            <button onClick={() => setDraft(null)}>← Voltar aos eventos</button>
            <div className={box}>
              <h2 className="text-2xl font-bold">{draft.event.client_name}</h2>
              <p>
                {draft.event.event_date.split("-").reverse().join("/")} •{" "}
                {draft.event.formation} • {draft.event.location_name}
              </p>
              <EventServices event={draft.event} />
              <Link
                className="my-3 inline-block text-sm font-semibold text-violet-700"
                href={`/eventos/${draft.event.id}`}
              >
                Abrir cadastro completo do evento
              </Link>
              <Field label="Valor contratado confirmado por você (R$)">
                <MoneyInput
                  key={`${draft.event.id}:${draft.revision}`}
                  value={draft.contract_cents}
                  onValue={(n) =>
                    setDraft((d) => ({ ...d, contract_cents: n }))
                  }
                />
              </Field>
              <Field label="Data prevista para receber o saldo em aberto">
                <input
                  type="date"
                  max={receiptDeadline(draft.event.event_date) || undefined}
                  className={input}
                  value={
                    draft.expected_receipt_on || receiptDeadline(draft.event.event_date) || ""
                  }
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      expected_receipt_on: e.target.value || null,
                    }))
                  }
                />
              </Field>
              <p className="mt-1 text-xs text-slate-600">
                Prazo padrão: dois dias antes do evento. Você pode antecipar essa
                previsão. As datas dos recebimentos realizados ficam preservadas.
              </p>
              <p className="mt-3">
                Recebido: {money(current.received)} • A receber:{" "}
                {money(current.open)} • Custos: {money(current.total)} • Margem
                prevista: <strong>{money(current.margin)}</strong>
              </p>
              <div className="mt-4 space-y-2 rounded-xl border p-3">
                <h3 className="font-semibold">Recebimentos deste evento</h3>
                <p className="text-sm">Para corrigir um valor, estorne o lançamento e registre o correto. Para duplicatas, estorne apenas a cópia.</p>
                {history.filter((l) => l.kind === "receipt").map((l) => (
                  <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-2">
                    <span>{money(l.amount_cents)} • {l.occurred_on.split("-").reverse().join("/")} • {l.method} {activeIds.has(l.id) ? "" : "• ESTORNADO"}</span>
                    {activeIds.has(l.id) && <button disabled={busy} className="text-red-700 font-semibold" onClick={() => {
                      const notes = window.prompt(`Estornar o recebimento de ${money(l.amount_cents)}? Informe o motivo:`, "Recebimento lançado em duplicidade");
                      if (notes?.trim()) run({action: "reverse", entry_id: l.id, notes});
                    }}>Estornar / corrigir recebimento</button>}
                  </div>
                ))}
                {!history.some((l) => l.kind === "receipt") && <p className="text-sm">Nenhum recebimento registrado.</p>}
              </div>
              {current.overpayment > 0 && (
                <p className="text-red-700">
                  Recebido acima do contrato: {money(current.overpayment)}.
                  Confira os lançamentos.
                </p>
              )}
            </div>
            <h3 className="text-xl font-bold">Músicos e outros custos</h3>
            <p>
              Cachês sugeridos são editáveis. Salve a ficha antes de registrar
              pagamentos. Confira se a escala cobre a formação e o receptivo;
              alterações posteriores da escala precisam ser revisadas.
            </p>
            {draft.costs.map((c, i) => {
              if (c.excluded) return null;
              const calculated = current.costs.find((x) => x.id === c.id);
              return (
                <div
                  key={c.id}
                  className={`${box} grid items-end gap-3 sm:grid-cols-3`}
                >
                  <Field label="Descrição">
                    <input
                      className={input}
                      value={c.description}
                      onChange={(e) =>
                        costEdit(i, { description: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Categoria livre">
                    <input
                      list="categories"
                      className={input}
                      value={c.category}
                      onChange={(e) =>
                        costEdit(i, { category: e.target.value })
                      }
                    />
                  </Field>
                  <Field
                    label={`Valor do evento (R$)${c.category === "musician" ? ` • Padrão: ${money(c.default_cents)}` : ""}`}
                  >
                    <MoneyInput
                      key={`${c.id}:${draft.revision}`}
                      value={c.amount_cents}
                      onValue={(n) => costEdit(i, { amount_cents: n })}
                    />
                  </Field>
                  <Field label="Pagar até (padrão: data do evento)">
                    <input
                      type="date"
                      className={input}
                      value={c.due_on || draft.event.event_date || ""}
                      onChange={(e) =>
                        costEdit(i, { due_on: e.target.value || null })
                      }
                    />
                  </Field>
                  <Field label="Status do acordo">
                    <select
                      className={input}
                      value={c.status}
                      onChange={(e) => costEdit(i, { status: e.target.value })}
                    >
                      <option value="predicted">Previsto</option>
                      <option value="confirmed">Confirmado</option>
                    </select>
                  </Field>
                  <Field label="Observação">
                    <input
                      className={input}
                      value={c.notes || ""}
                      onChange={(e) => costEdit(i, { notes: e.target.value })}
                    />
                  </Field>
                  <div>
                    <p>
                      Pago: {money(calculated.paid)} • Saldo:{" "}
                      {money(calculated.open)}
                    </p>
                    <strong>
                      {calculated.paid >= c.amount_cents && c.amount_cents > 0
                        ? "Pago"
                        : calculated.paid > 0
                          ? "Pago parcialmente"
                          : c.status === "confirmed"
                            ? "Confirmado"
                            : "Previsto"}
                    </strong>
                  </div>
                  <div className="flex flex-wrap gap-3 sm:col-span-3">
                    <button
                      disabled={
                        busy ||
                        !data.settings ||
                        !data.sheets
                          .find((s) => s.event_id === draft.event.id)
                          ?.costs.some((x) => x.id === c.id)
                      }
                      className={button}
                      onClick={() =>
                        newMovement("payment", draft.event.id, c.id)
                      }
                    >
                      Registrar pagamento
                    </button>
                    {c.musician_id && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          run({
                            action: "default",
                            key: `musician:${c.musician_id}`,
                            amount_cents: c.amount_cents,
                          })
                        }
                      >
                        Atualizar também o padrão
                      </button>
                    )}
                    <button
                      disabled={calculated.paid > 0}
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          costs: d.costs.map((x) =>
                            x.id === c.id ? excludeCost(x) : x,
                          ),
                        }))
                      }
                    >
                      Remover custo
                    </button>
                  </div>
                </div>
              );
            })}
            {draft.costs.some((c) => c.excluded) && (
              <details className={`${box} text-sm`}>
                <summary className="cursor-pointer font-semibold">
                  Custos removidos deste evento (
                  {draft.costs.filter((c) => c.excluded).length})
                </summary>
                <p className="mt-2 text-slate-600">
                  Não entram nos custos nem são recriados automaticamente. A
                  alteração fica registrada ao salvar.
                </p>
                {draft.costs
                  .filter((c) => c.excluded)
                  .map((c) => (
                    <div
                      key={c.id}
                      className="mt-2 flex flex-wrap items-center justify-between gap-2"
                    >
                      <span>{c.description}</span>
                      <button
                        className="font-semibold text-violet-700"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            costs: d.costs.map((x) =>
                              x.id === c.id ? restoreCost(x) : x,
                            ),
                          }))
                        }
                      >
                        Restaurar custo
                      </button>
                    </div>
                  ))}
              </details>
            )}
            <datalist id="categories">
              {[
                "musician",
                "sonorização",
                "transporte",
                "operacional",
                "hospedagem",
                "alimentação",
                "outros",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </datalist>
            <button
              className={button}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  costs: [
                    ...d.costs,
                    {
                      id: crypto.randomUUID(),
                      description: "",
                      category: "outros",
                      status: "predicted",
                      amount_cents: 0,
                      notes: "",
                    },
                  ],
                }))
              }
            >
              + Outro custo
            </button>
            <div className="sticky bottom-3 flex flex-wrap gap-3 rounded-2xl border bg-white p-3 shadow-lg">
              <button
                disabled={busy}
                className={button}
                onClick={() => saveEvent(false, false)}
              >
                Salvar em conferência
              </button>
              <button
                disabled={busy}
                className={button}
                onClick={() => saveEvent()}
              >
                Salvar como CONFERIDO
              </button>
              <button
                disabled={busy}
                className={button}
                onClick={() => saveEvent(true)}
              >
                Salvar e próximo evento
              </button>
            </div>
          </section>
        )}
        {tab === "musicians" && (
          <>
            <Metric
              label="Total a pagar aos músicos (fichas conferidas)"
              value={stats.musician}
            />
            {debt.map((d) => (
              <div key={d.key} className={box}>
                <button
                  className="w-full text-left"
                  onClick={() => setMusician(musician === d.key ? "" : d.key)}
                >
                  <strong>{d.name}</strong>
                  <p>
                    {new Set(d.events.map((x) => x.event.id)).size} eventos •
                    Previsto/confirmado: {money(d.total)} • Pago:{" "}
                    {money(d.paid)} • A pagar: {money(d.open)}
                  </p>
                </button>
                {musician === d.key &&
                  d.events.map(({ event, cost }) => (
                    <button
                      key={cost.id}
                      className="mt-2 block text-violet-700"
                      onClick={() => openEvent(event)}
                    >
                      {event.client_name} • {event.event_date} •{" "}
                      {money(cost.open)}
                    </button>
                  ))}
              </div>
            ))}
          </>
        )}
        {tab === "settings" && (
          <section className={box}>
            <h2 className="text-xl font-bold">
              Configurações do novo financeiro
            </h2>
            <p>
              Marco zero:{" "}
              {data.settings
                ? `${data.settings.opening_on} • ${money(data.settings.opening_cents)}`
                : "Ainda não definido"}
              . Padrões são sugestões para custos novos, sem alterar acordos já
              salvos.
            </p>
            <form
              className="mt-4 flex flex-wrap items-end gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await run({
                    action: "default",
                    key: defaultForm.key,
                    amount_cents: cents(defaultForm.amount),
                  });
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              <Field label="Músico, função ou custo padrão">
                <select
                  required
                  className={input}
                  value={defaultForm.key}
                  onChange={(e) =>
                    setDefaultForm({ ...defaultForm, key: e.target.value })
                  }
                >
                  <option value="">Selecione</option>
                  <option value="general:musician">
                    Cachê geral por músico
                  </option>
                  <option value="cost:sonorização">Sonorização</option>
                  <option value="cost:transporte">
                    Transporte / deslocamento
                  </option>
                  <option value="cost:operacional">Operacional</option>
                  {[
                    ...new Map(
                      data.musicians.map((m) => [
                        `musician:${m.musician_id}`,
                        m,
                      ]),
                    ).values(),
                  ]
                    .filter((m) => m.musician_id)
                    .map((m) => (
                      <option
                        key={m.musician_id}
                        value={`musician:${m.musician_id}`}
                      >
                        {m.name}
                      </option>
                    ))}
                  {[
                    ...new Set(
                      data.musicians.map((m) => m.role).filter(Boolean),
                    ),
                  ].map((r) => (
                    <option key={r} value={`role:${r}`}>
                      Função: {r}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Valor padrão (R$)">
                <input
                  required
                  inputMode="decimal"
                  className={input}
                  value={defaultForm.amount}
                  onChange={(e) =>
                    setDefaultForm({ ...defaultForm, amount: e.target.value })
                  }
                />
              </Field>
              <button className={button} disabled={busy}>
                Salvar padrão
              </button>
            </form>
            <ul className="mt-3 space-y-2">
              {data.defaults.map((d) => (
                <li key={d.key}>
                  {d.key.startsWith("musician:")
                    ? data.musicians.find(
                        (m) => `musician:${m.musician_id}` === d.key,
                      )?.name || d.key
                    : d.key === "general:musician"
                      ? "Cachê geral por músico"
                      : d.key
                          .replace("role:", "Função: ")
                          .replace("cost:", "Custo: ")}
                  : {money(d.amount_cents)}
                </li>
              ))}
            </ul>
          </section>
        )}
        {(tab === "cash" || draft) && (
          <section className={box}>
            <h2 className="text-xl font-bold">
              Histórico de movimentos {draft ? "do evento" : ""}
            </h2>
            <p className="text-sm">
              Para editar um lançamento, estorne com motivo e registre o valor
              correto. O original fica preservado.
            </p>
            <div className="mt-3 max-h-96 space-y-2 overflow-auto">
              {history.map((l) => (
                <div
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
                >
                  <div>
                    <strong>{money(l.amount_cents)}</strong> • {l.occurred_on} •{" "}
                    {
                      {
                        receipt: "Recebimento",
                        payment: "Pagamento de custo",
                        withdrawal: "Retirada pessoal",
                        reversal: "Estorno",
                      }[l.kind]
                    }
                    <p className="text-sm">
                      {data.events.find((e) => e.id === l.event_id)
                        ?.client_name || l.destination}{" "}
                      • {l.origin || l.method}{" "}
                      {l.in_opening ? "• Incluído no marco zero" : ""}{" "}
                      {l.kind !== "reversal" && !activeIds.has(l.id)
                        ? "• ESTORNADO"
                        : ""}
                    </p>
                    <p className="text-sm">{l.notes}</p>
                    {l.proof_reference && (
                      <a
                        href={l.proof_reference}
                        target="_blank"
                        rel="noreferrer"
                        className="text-violet-700"
                      >
                        Comprovante
                      </a>
                    )}
                  </div>
                  {activeIds.has(l.id) && (
                    <button
                      disabled={busy}
                      className="text-red-700"
                      onClick={() => {
                        const notes = window.prompt(
                          "Motivo do estorno (obrigatório)",
                        );
                        if (notes?.trim())
                          run({ action: "reverse", entry_id: l.id, notes });
                      }}
                    >
                      Estornar / corrigir
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </AdminShell>
  );
}
