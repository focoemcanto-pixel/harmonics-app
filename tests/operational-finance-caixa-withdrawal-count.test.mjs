import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
test("indicador de retiradas ignora movimentos já incluídos no marco zero",()=>{const ledger=[{id:"w0",kind:"withdrawal",amount_cents:50000,occurred_on:"2026-10-01",in_opening:true},{id:"w1",kind:"withdrawal",amount_cents:20000,occurred_on:"2026-10-18",in_opening:false}],r=receivablesOverview([],[],ledger,null,"2026-10-18");assert.equal(r.totals.withdrawals,20000)});
