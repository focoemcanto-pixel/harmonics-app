import { test } from "node:test";
import assert from "node:assert/strict";
import { expectedReceiptDate } from "../lib/operational-finance/model.mjs";
test("previsão manual posterior a dois dias antes é limitada",()=>assert.equal(expectedReceiptDate({event_date:"2026-11-10"},{expected_receipt_on:"2026-11-09"}),"2026-11-08"));
