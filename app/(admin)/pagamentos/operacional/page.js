"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  activeEntries,
  cents,
  dashboard,
  eventSummary,
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
    const costs = structuredClone(saved?.costs || []);
    for (const m of source.musicians.filter((m) => m.event_id === e.id)) {
      if (costs.some((c) => c.scale_id === m.id)) continue;
      const key = `musician:${m.musician_id}`;
      const def =
        source.defaults.find((d) => d.key === key) ||
        source.defaults.find((d) => d.key === `role:${m.role}`);
      costs.push({
        id: crypto.randomUUID(),
        scale_id: m.id,
        musician_id: m.musician_id,
        description: `${m.name} — ${m.role || "Músico"}`,
        category: "musician",
        status: "predicted",
        amount_cents: def?.amount_cents || 0,
        notes: "",
        default_cents: def?.amount_cents || 0,
      });
    }
    setDraft({
      event: e,
      revision: saved?.revision || 0,
      contract_cents:
        saved?.contract_cents ?? Math.round(Number(e.agreed_amount || 0) * 100),
      costs,
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
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[
                ["Caixa atual", stats.cash],
                ["Compromissos com músicos", stats.musician],
                ["Outros compromissos", stats.other],
                ["Total comprometido", stats.committed],
                ["Caixa livre", stats.free, true],
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
                  ? `Hoje faltam ${money(-stats.free)} para cobrir os compromissos. Os recebimentos conferidos cobrem esse déficit, sem garantia de prazo.`
                  : `Mesmo com os recebimentos conferidos, falta ${money(-stats.projected)}.`
                : `Caixa livre atual: ${money(stats.free)}.`}{" "}
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
                {draft.event.event_date} • {draft.event.formation} •{" "}
                {draft.event.location_name}
              </p>
              <Field label="Valor contratado confirmado por você (R$)">
                <MoneyInput
                  key={`${draft.event.id}:${draft.revision}`}
                  value={draft.contract_cents}
                  onValue={(n) =>
                    setDraft((d) => ({ ...d, contract_cents: n }))
                  }
                />
              </Field>
              <p className="mt-3">
                Recebido: {money(current.received)} • A receber:{" "}
                {money(current.open)} • Custos: {money(current.total)} • Margem
                prevista: <strong>{money(current.margin)}</strong>
              </p>
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
                          costs: d.costs.filter((x) => x.id !== c.id),
                        }))
                      }
                    >
                      Remover custo
                    </button>
                  </div>
                </div>
              );
            })}
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
              <Field label="Músico ou função">
                <select
                  required
                  className={input}
                  value={defaultForm.key}
                  onChange={(e) =>
                    setDefaultForm({ ...defaultForm, key: e.target.value })
                  }
                >
                  <option value="">Selecione</option>
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
              <Field label="Cachê padrão (R$)">
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
                    : d.key.replace("role:", "Função: ")}
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
