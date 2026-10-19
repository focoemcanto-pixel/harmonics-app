import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql = readFileSync(new URL("../supabase/migrations/20261019120000_operational_cash_adjustment.sql", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/operational-finance/route.js", import.meta.url), "utf8");
test("ajuste de conciliação exige motivo, não pertence a evento e não é histórico do marco zero", () => {
  assert.match(sql, /'adjustment_in','adjustment_out'/);
  assert.match(sql, /event_id is null and cost_id is null and in_opening = false and nullif\(btrim\(notes\), ''\) is not null/);
  assert.match(sql, /Informe o motivo do ajuste de conciliação/);
  assert.match(sql, /Ajuste de conciliação deve ser posterior ao marco zero/);
  assert.match(api, /"adjustment_in", "adjustment_out"/);
});
test("migração é aditiva: não altera nem apaga lançamentos existentes", () => {
  assert.doesNotMatch(sql, /\bupdate\s+public\.op_finance_ledger\b|\bdelete\s+from\b/i);
});
