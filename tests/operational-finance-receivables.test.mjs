import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard, monthlyCommitments } from "../lib/operational-finance/model.mjs";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";

const event = { id: "joseane", client_name: "Joseane", event_date: "2026-10-17", agreed_amount: 1450, status: "confirmado" };
const sheet = { event_id: "joseane", status: "checked", contract_cents: 145000, expected_receipt_on: "2026-10-15", costs: [{ id: "m1", category: "musician", amount_cents: 65000 }] };
const receipt = (amount, id = "r1", occurred_on = "2026-10-14", in_opening = false) => ({ id, event_id: "joseane", kind: "receipt", amount_cents: amount, occurred_on, created_at: `${occurred_on}T12:00:00Z`, in_opening });
const settings = { opening_on: "2026-10-01", opening_cents: 1000000 };

test("recebimento parcial consome a previsão e mantém apenas o saldo", () => {
  const result = receivablesOverview([event], [sheet], [receipt(100000)], settings, "2026-10-14");
  assert.equal(result.rows[0].received, 100000);
  assert.equal(result.rows[0].open, 45000);
  assert.equal(result.rows[0].status, "partial");
  assert.equal(result.months[0].realized, 100000);
  assert.equal(result.months[0].remaining, 45000);
  assert.equal(result.months[0].expected, 145000);
});

test("caixa inicial não duplica lançamentos marcados como históricos", () => {
  const stats = dashboard([event], [sheet], [receipt(100000, "r0", "2026-10-02", true), receipt(50000, "r1", "2026-10-14")], settings, "2026-10-14");
  assert.equal(stats.cash, 1050000);
});

test("retirada reduz caixa e projeção sem alterar margem econômica", () => {
  const withdrawal = { id: "w1", kind: "withdrawal", amount_cents: 200000, occurred_on: "2026-10-14", in_opening: false };
  const stats = dashboard([event], [sheet], [withdrawal], settings, "2026-10-14");
  assert.equal(stats.cash, 800000);
  assert.equal(stats.projected, 880000);
  assert.equal(stats.margin, 80000);
});

test("cachês futuros pesam na projeção e deixam de pesar após o evento", () => {
  const before = dashboard([event], [sheet], [], settings, "2026-10-16");
  assert.equal(before.musician, 65000);
  assert.equal(before.projected, 1080000);
  const after = dashboard([event], [sheet], [], settings, "2026-10-18");
  assert.equal(after.musician, 0);
  assert.equal(after.projected, 1145000);
  const planning = monthlyCommitments([event], [sheet], [], "2026-10-18");
  assert.equal(planning.arrearsTotal, 0);
  assert.equal(planning.months.reduce((sum, row) => sum + row.musician, 0), 0);
});

test("quitação zera a entrada futura sem apagar os recebimentos", () => {
  const ledger = [receipt(100000), receipt(45000, "r2", "2026-10-15")];
  const result = receivablesOverview([event], [sheet], ledger, settings, "2026-10-15");
  assert.equal(result.rows[0].received, 145000);
  assert.equal(result.rows[0].open, 0);
  assert.equal(result.rows[0].status, "paid");
  assert.equal(result.rows[0].receipts.length, 2);
  assert.equal(result.months[0].realized, 145000);
  assert.equal(result.months[0].remaining, 0);
});

test("estorno retira efeito do recebimento sem apagar histórico bruto", () => {
  const ledger = [receipt(100000), { id: "rev", kind: "reversal", reverses_id: "r1", event_id: "joseane", amount_cents: 100000, occurred_on: "2026-10-15" }];
  const result = receivablesOverview([event], [sheet], ledger, settings, "2026-10-15");
  assert.equal(result.rows[0].received, 0);
  assert.equal(result.rows[0].open, 145000);
  assert.equal(result.rows[0].status, "pending");
});
