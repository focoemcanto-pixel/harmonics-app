import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
test("overview vazio é estável",()=>assert.deepEqual(receivablesOverview([],[],[],null,"2026-10-18"),receivablesOverview([],[],[],null,"2026-10-18")));
