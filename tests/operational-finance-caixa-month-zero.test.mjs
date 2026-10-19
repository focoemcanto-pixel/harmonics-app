import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
test("overview vazio não inventa movimentos",()=>{const r=receivablesOverview([],[],[],null,"2026-10-18");assert.deepEqual(r.months,[]);assert.equal(r.totals.open,0)});
