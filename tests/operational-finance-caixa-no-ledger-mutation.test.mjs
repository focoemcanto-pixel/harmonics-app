import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
test("dashboard não reescreve lançamentos históricos",()=>{const ledger=[{id:"r",kind:"receipt",amount_cents:1000,occurred_on:"2026-10-18",in_opening:false}],before=JSON.stringify(ledger);dashboard([],[],ledger,{opening_on:"2026-10-01",opening_cents:0},"2026-10-18");assert.equal(JSON.stringify(ledger),before)});
