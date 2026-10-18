import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const settings={opening_on:"2026-10-01",opening_cents:100000};
test("uma entrada de 500 aumenta caixa em 500",()=>{const r=dashboard([],[],[{id:"r",kind:"receipt",amount_cents:50000,occurred_on:"2026-10-18",in_opening:false}],settings,"2026-10-18");assert.equal(r.cash,150000)});
