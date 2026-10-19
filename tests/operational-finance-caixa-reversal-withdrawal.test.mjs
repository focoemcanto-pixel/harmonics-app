import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
test("estornar retirada neutraliza a saída",()=>{const ledger=[{id:"w",kind:"withdrawal",amount_cents:30000,occurred_on:"2026-10-18",in_opening:false},{id:"x",kind:"reversal",reverses_id:"w",amount_cents:30000,occurred_on:"2026-10-18"}],r=dashboard([],[],ledger,{opening_on:"2026-10-01",opening_cents:100000},"2026-10-18");assert.equal(r.cash,100000)});
