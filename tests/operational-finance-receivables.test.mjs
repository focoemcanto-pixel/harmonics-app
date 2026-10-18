import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";

const event = { id: "joseane", client_name: "Joseane", event_date: "2026-10-17", agreed_amount: 1450, status: "confirmado" };
const sheet = { event_id: "joseane", status: "checked", contract_cents: 145000, expected_receipt_on: "2026-10-15", costs: [{ id: "m1", category: "musician", amount_cents: 65000 }] };
const receipt = (amount, id = "r1", occurred_on = "2026-10-14") => ({ id, event_id: "joseane", kind: "receipt", amount_cents: amount, occurred_on, created_at: `${occurred_on}T12:00:00Z`, in_opening: false });

test("recebimento parcial consome a previsão e mantém apenas o saldo", () => {
  const result = receivablesOverview([event], [sheet], [receipt(100000)], "2026-10-14");
  assert.equal(result.rows[0].received, 100000);
  assert.equal(result.rows[0].open, 45000);
  assert.equal(result.rows[0].status, "partial");
  assert.equal(result.months[0].realized, 100000);
  assert.equal(result.months[0].remaining, 45000);
  assert.equal(result.months[0].expected, 145000);
});

test("quitação zera a entrada futura sem apagar os recebimentos", () => {
  const ledger = [receipt(100000), receipt(45000, "r2", "2026-10-15")];
  const result = receivablesOverview([event], [sheet], ledger, "2026-10-15");
  assert.equal(result.rows[0].received, 145000);
  assert.equal(result.rows[0].open, 0);
  assert.equal(result.rows[0].status, "paid");
  assert.equal(result.rows[0].receipts.length, 2);
  assert.equal(result.months[0].realized, 145000);
  assert.equal(result.months[0].remaining, 0);
});

test("cachê entra no custo e margem, mas não vira recebível", () => {
  const result = receivablesOverview([event], [sheet], [], "2026-10-14");
  assert.equal(result.totals.costs, 65000);
  assert.equal(result.totals.margin, 80000);
  assert.equal(result.totals.open, 145000);
});

test("estorno retira efeito do recebimento sem apagar histórico bruto", () => {
  const ledger = [receipt(100000), { id: "rev", kind: "reversal", reverses_id: "r1", event_id: "joseane", amount_cents: 100000, occurred_on: "2026-10-15" }];
  const result = receivablesOverview([event], [sheet], ledger, "2026-10-15");
  assert.equal(result.rows[0].received, 0);
  assert.equal(result.rows[0].open, 145000);
  assert.equal(result.rows[0].status, "pending");
});
