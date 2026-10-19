import { test } from "node:test";
import assert from "node:assert/strict";
import { cashPosition, dashboard, monthlyCommitments } from "../lib/operational-finance/model.mjs";
import { eventHistory, matchesEventSearch, receivablesOverview } from "../lib/operational-finance/receivables.mjs";

// Motor único do caixa: marco zero → recebimentos → evento acontece → cachês realizados → caixa diminui.
const settings = { opening_on: "2026-10-13", opening_cents: 1000000 };
const ev = (id, event_date, extra = {}) => ({ id, client_name: `Cliente ${id}`, event_date, location_name: `Local ${id}`, agreed_amount: 2000, status: "Confirmado", ...extra });
const sheet = (event_id, contract_cents, costs, status = "checked") => ({ event_id, status, contract_cents, costs });
const cost = (id, amount_cents, category = "musician") => ({ id, category, amount_cents, description: id, status: "predicted" });
let n = 0;
const entry = (kind, amount_cents, occurred_on, extra = {}) => ({ id: `l${++n}`, kind, amount_cents, occurred_on, in_opening: false, created_at: `${occurred_on}T12:00:00Z`, ...extra });

test("marco zero: sem movimentos o caixa é o saldo inicial", () => {
  assert.equal(cashPosition([], [], [], settings, "2026-10-14").cash, 1000000);
});

test("lançamento já incluído no caixa inicial fica no histórico e não altera o caixa", () => {
  const e = ev("a", "2026-12-01"), s = sheet("a", 200000, []);
  const ledger = [entry("receipt", 80000, "2026-10-13", { event_id: "a", in_opening: true }), entry("receipt", 50000, "2026-10-05", { event_id: "a" })];
  const p = cashPosition([e], [s], ledger, settings, "2026-10-14");
  assert.equal(p.cash, 1000000);
  assert.equal(receivablesOverview([e], [s], ledger, settings, "2026-10-14").rows[0].received, 130000);
});

test("novo recebimento após o marco zero aumenta o caixa", () => {
  const p = cashPosition([ev("a", "2026-12-01")], [sheet("a", 200000, [])], [entry("receipt", 120000, "2026-10-15", { event_id: "a" })], settings, "2026-10-16");
  assert.equal(p.cash, 1120000);
});

test("recebimento parcial e quitação: recebido substitui a previsão", () => {
  const e = ev("a", "2026-12-01"), s = sheet("a", 200000, []);
  const partial = [entry("receipt", 120000, "2026-10-15", { event_id: "a" })];
  const r1 = receivablesOverview([e], [s], partial, settings, "2026-10-16").rows[0];
  assert.deepEqual([r1.received, r1.open, r1.status], [120000, 80000, "partial"]);
  const paid = [...partial, entry("receipt", 80000, "2026-10-17", { event_id: "a" })];
  const r2 = receivablesOverview([e], [s], paid, settings, "2026-10-18").rows[0];
  assert.deepEqual([r2.received, r2.open, r2.status], [200000, 0, "paid"]);
  assert.equal(dashboard([e], [s], paid, settings, "2026-10-18").receivable, 0);
});

test("evento futuro: cachê é compromisso e não mexe no caixa real", () => {
  const d = dashboard([ev("a", "2026-12-01")], [sheet("a", 0, [cost("m", 100000)])], [], settings, "2026-10-14");
  assert.equal(d.cash, 1000000);
  assert.equal(d.committed, 100000);
  assert.equal(d.projected, 900000);
});

test("evento que acabou de passar: cachê migra de futuro para realizado e a projeção não sobe", () => {
  const e = ev("a", "2026-10-20"), s = sheet("a", 0, [cost("m", 100000)]);
  const before = dashboard([e], [s], [], settings, "2026-10-20");
  const after = dashboard([e], [s], [], settings, "2026-10-21");
  assert.deepEqual([before.cash, before.committed, before.projected], [1000000, 100000, 900000]);
  assert.deepEqual([after.cash, after.committed, after.projected], [900000, 0, 900000]);
});

test("realização automática é idempotente e não cria lançamentos", () => {
  const e = ev("a", "2026-10-15"), s = sheet("a", 0, [cost("m1", 60000), cost("o1", 20000, "transporte")]), ledger = [];
  const p1 = cashPosition([e], [s], ledger, settings, "2026-10-20"), p2 = cashPosition([e], [s], ledger, settings, "2026-10-25");
  assert.equal(ledger.length, 0);
  assert.equal(p1.realizedCosts, 80000);
  assert.equal(p2.realizedCosts, 80000);
  assert.deepEqual(p1.realizedEvents.map((x) => [x.musician, x.other]), [[60000, 20000]]);
});

test("pagamento manual/legado do custo não é deduzido duas vezes", () => {
  const e = ev("a", "2026-10-15"), s = sheet("a", 0, [cost("m", 100000)]);
  const ledger = [entry("payment", 40000, "2026-10-14", { event_id: "a", cost_id: "m" })];
  const p = cashPosition([e], [s], ledger, settings, "2026-10-20");
  assert.equal(p.payments, 40000);
  assert.equal(p.realizedCosts, 60000);
  assert.equal(p.cash, 900000);
  const paidBeforeOpening = [entry("payment", 100000, "2026-10-10", { event_id: "a", cost_id: "m", in_opening: true })];
  assert.equal(cashPosition([e], [s], paidBeforeOpening, settings, "2026-10-20").cash, 1000000);
});

test("evento anterior ao marco zero não é deduzido novamente", () => {
  const p = cashPosition([ev("a", "2026-10-05")], [sheet("a", 0, [cost("m", 100000)])], [], settings, "2026-10-20");
  assert.equal(p.realizedCosts, 0);
  assert.equal(p.cash, 1000000);
});

test("retirada reduz caixa e projeção sem virar custo do evento", () => {
  const e = ev("a", "2026-12-01"), s = sheet("a", 200000, [cost("m", 50000)]);
  const d = dashboard([e], [s], [entry("withdrawal", 30000, "2026-10-15")], settings, "2026-10-16");
  assert.equal(d.cash, 970000);
  assert.equal(d.projected, 970000 + 200000 - 50000);
  assert.equal(receivablesOverview([e], [s], [], settings, "2026-10-16").rows[0].margin, 150000);
});

test("estorno anula o lançamento original sem apagar o histórico", () => {
  const e = ev("a", "2026-12-01"), s = sheet("a", 200000, []);
  const receipt = entry("receipt", 120000, "2026-10-15", { event_id: "a" });
  const ledger = [receipt, entry("reversal", 120000, "2026-10-16", { event_id: "a", reverses_id: receipt.id })];
  const p = cashPosition([e], [s], ledger, settings, "2026-10-17");
  assert.equal(p.cash, 1000000);
  assert.equal(p.reversed, 1);
  const h = eventHistory(e, s, ledger, settings, "2026-10-17");
  assert.equal(h.length, 2);
  assert.ok(h.find((x) => x.id === receipt.id).reversed);
});

test("evento cancelado não gera custo futuro, custo realizado nem valor a receber", () => {
  const cancelledFuture = ev("f", "2026-12-01", { status: "Cancelado" }), cancelledPast = ev("p", "2026-10-15", { status: "cancelled" });
  const sheets = [sheet("f", 200000, [cost("m1", 50000)]), sheet("p", 200000, [cost("m2", 50000)])];
  const d = dashboard([cancelledFuture, cancelledPast], sheets, [], settings, "2026-10-20");
  assert.deepEqual([d.cash, d.committed, d.receivable, d.projected], [1000000, 0, 0, 1000000]);
  assert.equal(monthlyCommitments([cancelledFuture], [sheets[0]], [], "2026-10-20").months.reduce((s, m) => s + m.total, 0), 0);
});

test("projeção = caixa real + ainda a receber − compromissos futuros", () => {
  const events = [ev("a", "2026-10-15"), ev("b", "2026-11-10")];
  const sheets = [sheet("a", 150000, [cost("m1", 50000)]), sheet("b", 300000, [cost("m2", 100000), cost("o", 20000, "sonorização")])];
  const ledger = [entry("receipt", 150000, "2026-10-14", { event_id: "a" }), entry("receipt", 100000, "2026-10-16", { event_id: "b" })];
  const d = dashboard(events, sheets, ledger, settings, "2026-10-20");
  assert.equal(d.cash, 1000000 + 250000 - 50000);
  assert.equal(d.receivable, 200000);
  assert.equal(d.committed, 120000);
  assert.equal(d.projected, d.cash + d.receivable - d.committed);
});

test("busca global encontra eventos de qualquer mês por nome, data ou local", () => {
  const rows = [
    { event_name: "Joseane Bispo", event_date: "2026-10-17", location_name: "Beach Villas Mansion" },
    { event_name: "Olga Neves", event_date: "2027-01-09", location_name: "Solar D'Kell" },
  ];
  assert.deepEqual(rows.filter((r) => matchesEventSearch(r, "olga")).map((r) => r.event_name), ["Olga Neves"]);
  assert.deepEqual(rows.filter((r) => matchesEventSearch(r, "09/01/2027")).map((r) => r.event_name), ["Olga Neves"]);
  assert.deepEqual(rows.filter((r) => matchesEventSearch(r, "beach villas")).map((r) => r.event_name), ["Joseane Bispo"]);
  assert.deepEqual(rows.filter((r) => matchesEventSearch(r, "solar dkell")).length, 0);
  assert.deepEqual(rows.filter((r) => matchesEventSearch(r, "Solar D'Kell")).map((r) => r.event_name), ["Olga Neves"]);
});

test("sequência crítica: marco zero → recebimentos → evento acontece → cachês realizados → caixa diminui", () => {
  // Mesma estrutura da reconciliação real do workspace (valores em centavos).
  const s0 = { opening_on: "2026-10-13", opening_cents: 163000 };
  const events = [ev("jo", "2026-10-17"), ev("pa", "2026-10-17"), ev("di", "2026-10-18"), ev("al", "2026-11-01"), ev("pe", "2026-12-13")];
  const sheets = [sheet("jo", 290000, [cost("j1", 65000), cost("j2", 0), cost("j3", 60000)]), sheet("pa", 210000, [cost("p1", 30000), cost("p2", 30000), cost("p3", 30000), cost("p4", 30000)]), sheet("di", 175000, [cost("d1", 0), cost("d2", 30000), cost("d3", 35000)]), sheet("al", 120000, []), sheet("pe", 280000, [])];
  const dup = entry("receipt", 280000, "2026-10-13", { event_id: "pe", in_opening: true });
  const ledger = [
    entry("receipt", 145000, "2026-10-08", { event_id: "jo", in_opening: true }),
    entry("receipt", 210000, "2026-10-13", { event_id: "pa", in_opening: true }),
    entry("receipt", 100000, "2026-10-13", { event_id: "di", in_opening: true }),
    entry("receipt", 280000, "2026-10-13", { event_id: "pe", in_opening: true }), dup,
    entry("reversal", 280000, "2026-10-13", { event_id: "pe", reverses_id: dup.id, in_opening: true }),
    entry("withdrawal", 160000, "2026-10-14"),
    entry("receipt", 60000, "2026-10-15", { event_id: "al" }),
    entry("receipt", 145000, "2026-10-18", { event_id: "jo" }),
    entry("receipt", 75000, "2026-10-18", { event_id: "di" }),
  ];
  const beforeEvents = cashPosition(events, sheets, ledger.slice(0, 8), s0, "2026-10-16");
  assert.equal(beforeEvents.cash, 163000 - 160000 + 60000); // recebimento novo aumentou o caixa
  const now = cashPosition(events, sheets, ledger, s0, "2026-10-19");
  assert.equal(now.receipts, 280000);
  assert.equal(now.withdrawals, 160000);
  assert.equal(now.realizedCosts, 125000 + 120000 + 65000);
  assert.equal(now.cash, 163000 + 280000 - 160000 - 310000);
  const projBefore = dashboard(events, sheets, ledger, s0, "2026-10-17").projected;
  const projAfter = dashboard(events, sheets, ledger, s0, "2026-10-19").projected;
  assert.equal(projAfter, projBefore); // a projeção não sobe quando os eventos passam
});

test("data manual de pagamento vencida de evento futuro fica em atraso, não migra para a data do evento", () => {
  const e = ev("a", "2026-11-20"), s = sheet("a", 0, [{ ...cost("m", 50000), due_on: "2026-10-10" }]);
  const p = monthlyCommitments([e], [s], [], "2026-10-13");
  assert.equal(p.arrearsTotal, 50000);
  assert.equal(p.arrears[0].overdue, true);
  assert.equal(p.months.reduce((n, m) => n + m.total, 0), 0);
  assert.equal(dashboard([e], [s], [], settings, "2026-10-13").committed, 50000);
});

test("ajuste de conciliação corrige o caixa sem virar retirada nem afetar a margem", () => {
  const e = ev("a", "2026-12-01"), s = sheet("a", 200000, [cost("m", 50000)]);
  const out = entry("adjustment_out", 203392, "2026-10-19", { notes: "Conferência com extrato" });
  const d = dashboard([e], [s], [out], settings, "2026-10-19");
  assert.equal(d.position.reconstructed, 1000000);
  assert.equal(d.position.adjustments, -203392);
  assert.equal(d.cash, 1000000 - 203392);
  assert.equal(d.position.withdrawals, 0);
  assert.equal(d.projected, d.cash + 200000 - 50000);
  const r = receivablesOverview([e], [s], [out], settings, "2026-10-19");
  assert.equal(r.totals.withdrawals, 0);
  assert.equal(r.rows[0].margin, 150000);
  const inn = entry("adjustment_in", 5000, "2026-10-19", { notes: "Tarifa estornada pelo banco" });
  assert.equal(cashPosition([e], [s], [out, inn], settings, "2026-10-19").cash, 1000000 - 203392 + 5000);
});

test("ajuste de conciliação estornado deixa de afetar o caixa e permanece no histórico", () => {
  const adj = entry("adjustment_out", 10000, "2026-10-19", { notes: "Diferença" });
  const ledger = [adj, entry("reversal", 10000, "2026-10-19", { reverses_id: adj.id, notes: "Lançado errado" })];
  const p = cashPosition([], [], ledger, settings, "2026-10-19");
  assert.equal(p.adjustments, 0);
  assert.equal(p.cash, 1000000);
  assert.equal(ledger.length, 2);
});

test("conciliação do saldo real: caixa reconstruído R$ 3.230,00 + ajuste −R$ 2.033,92 = R$ 1.196,08", () => {
  const s0 = { opening_on: "2026-10-13", opening_cents: 163000 };
  const events = [ev("jo", "2026-10-17"), ev("pa", "2026-10-17"), ev("di", "2026-10-18")];
  const sheets = [sheet("jo", 290000, [cost("j1", 125000)]), sheet("pa", 210000, [cost("p1", 120000)]), sheet("di", 175000, [cost("d1", 65000)])];
  const ledger = [entry("receipt", 630000, "2026-10-15", { event_id: "jo" }), entry("withdrawal", 160000, "2026-10-14")];
  const before = cashPosition(events, sheets, ledger, s0, "2026-10-19");
  assert.equal(before.cash, 323000);
  const adjusted = cashPosition(events, sheets, [...ledger, entry("adjustment_out", 323000 - 119608, "2026-10-19", { notes: "Saldo conferido" })], s0, "2026-10-19");
  assert.equal(adjusted.reconstructed, 323000);
  assert.equal(adjusted.cash, 119608);
});
