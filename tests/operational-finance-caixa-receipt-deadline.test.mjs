import { test } from "node:test";
import assert from "node:assert/strict";
import { expectedReceiptDate } from "../lib/operational-finance/model.mjs";
test("sem previsão manual usa dois dias antes do evento",()=>assert.equal(expectedReceiptDate({event_date:"2026-11-10"},{}),"2026-11-08"));
