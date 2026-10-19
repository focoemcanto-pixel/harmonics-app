import { test } from "node:test";
import assert from "node:assert/strict";
import { cashPosition, cashPositionAt, dashboard, monthlyCommitments } from "../lib/operational-finance/model.mjs";
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

test("busca global encontra fixtures sintéticos por nome, data e local", () => {
  const rows = [
    { event_name: "Cliente Alfa", event_date: "2044-03-07", location_name: "Salão Fictício Alfa" },
    { event_name: "Cliente Beta", event_date: "2045-08-23", location_name: "Espaço D'Exemplo" },
  ];
  assert.deepEqual(rows.filter((r) => matchesEventSearch(r, "beta")).map((r) => r.event_name), ["Cliente Beta"]);
  assert.deepEqual(rows.filter((r) => matchesEventSearch(r, "23/08/2045")).map((r) => r.event_name), ["Cliente Beta"]);
  assert.deepEqual(rows.filter((r) => matchesEventSearch(r, "salao ficticio")).map((r) => r.event_name), ["Cliente Alfa"]);
  assert.equal(rows.filter((r) => matchesEventSearch(r, "espaco dexemplo")).length, 0);
  assert.deepEqual(rows.filter((r) => matchesEventSearch(r, "Espaço D'Exemplo")).map((r) => r.event_name), ["Cliente Beta"]);
});

test("sequência sintética: marco zero, recebimentos, realização e projeção estável", () => {
  const syntheticSettings = { opening_on: "2044-03-02", opening_cents: 230000 };
  const events = [ev("synthetic-alpha", "2044-03-18"), ev("synthetic-beta", "2044-03-19"), ev("synthetic-gamma", "2044-03-20"), ev("synthetic-delta", "2044-06-12"), ev("synthetic-epsilon", "2044-07-09")];
  const sheets = [
    sheet("synthetic-alpha", 71000, [cost("synthetic-a1", 7300), cost("synthetic-a2", 9100)]),
    sheet("synthetic-beta", 83000, [cost("synthetic-b1", 11200), cost("synthetic-b2", 6400), cost("synthetic-b3", 3900)]),
    sheet("synthetic-gamma", 97000, [cost("synthetic-g1", 8700), cost("synthetic-g2", 12600)]),
    sheet("synthetic-delta", 53000, []), sheet("synthetic-epsilon", 59000, []),
  ];
  const dup = entry("receipt", 17000, "2044-02-24", { event_id: "synthetic-epsilon", in_opening: true });
  const ledger = [
    entry("receipt", 19000, "2044-02-21", { event_id: "synthetic-alpha", in_opening: true }),
    entry("receipt", 23000, "2044-02-22", { event_id: "synthetic-beta", in_opening: true }),
    entry("receipt", 31000, "2044-02-23", { event_id: "synthetic-gamma", in_opening: true }),
    entry("receipt", 17000, "2044-02-24", { event_id: "synthetic-epsilon", in_opening: true }), dup,
    entry("reversal", 17000, "2044-02-25", { event_id: "synthetic-epsilon", reverses_id: dup.id, in_opening: true }),
    entry("withdrawal", 4700, "2044-03-04"),
    entry("receipt", 21000, "2044-03-05", { event_id: "synthetic-delta" }),
    entry("receipt", 52000, "2044-03-16", { event_id: "synthetic-alpha" }),
    entry("receipt", 66000, "2044-03-17", { event_id: "synthetic-gamma" }),
  ];
  const beforeEvents = cashPosition(events, sheets, ledger.slice(0, 8), syntheticSettings, "2044-03-15");
  assert.equal(beforeEvents.cash, 246300);
  const now = cashPosition(events, sheets, ledger, syntheticSettings, "2044-03-21");
  assert.equal(now.receipts, 139000);
  assert.equal(now.withdrawals, 4700);
  assert.equal(now.realizedCosts, 59200);
  assert.equal(now.cash, 305100);
  const projBefore = dashboard(events, sheets, ledger, syntheticSettings, "2044-03-17").projected;
  const projAfter = dashboard(events, sheets, ledger, syntheticSettings, "2044-03-21").projected;
  assert.equal(projAfter, projBefore);
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

test("conciliação sintética ajusta o saldo reconstruído preservando sua origem", () => {
  const syntheticSettings = { opening_on: "2046-05-03", opening_cents: 183700 };
  const events = [ev("synthetic-one", "2046-05-09"), ev("synthetic-two", "2046-05-11"), ev("synthetic-three", "2046-05-14")];
  const sheets = [sheet("synthetic-one", 67000, [cost("synthetic-cost-one", 11300)]), sheet("synthetic-two", 89000, [cost("synthetic-cost-two", 15700)]), sheet("synthetic-three", 103000, [cost("synthetic-cost-three", 21900)])];
  const ledger = [entry("receipt", 34700, "2046-05-07", { event_id: "synthetic-one" }), entry("withdrawal", 8600, "2046-05-08")];
  const before = cashPosition(events, sheets, ledger, syntheticSettings, "2046-05-16");
  assert.equal(before.cash, 160900);
  const adjusted = cashPosition(events, sheets, [...ledger, entry("adjustment_out", 27600, "2046-05-16", { notes: "Conciliação sintética" })], syntheticSettings, "2046-05-16");
  assert.equal(adjusted.reconstructed, 160900);
  assert.equal(adjusted.cash, 133300);
});

test("conciliação retroativa usa o saldo da data escolhida, sem movimentos posteriores", () => {
  const e = ev("a", "2026-10-16"), s = sheet("a", 0, [cost("m", 40000)]);
  const ledger = [entry("receipt", 100000, "2026-10-14", { event_id: "a" }), entry("receipt", 50000, "2026-10-18", { event_id: "a" })];
  assert.equal(cashPositionAt([e], [s], ledger, settings, "2026-10-15").cash, 1100000);
  assert.equal(cashPositionAt([e], [s], ledger, settings, "2026-10-17").cash, 1060000);
  assert.equal(cashPositionAt([e], [s], ledger, settings, "2026-10-19").cash, cashPosition([e], [s], ledger, settings, "2026-10-19").cash);
});
