import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const settings={opening_on:"2026-10-01",opening_cents:500000};
test("lançamento marcado in_opening não soma nem subtrai novamente",()=>{const ledger=[{id:"r",kind:"receipt",amount_cents:100000,occurred_on:"2026-10-18",in_opening:true},{id:"w",kind:"withdrawal",amount_cents:50000,occurred_on:"2026-10-18",in_opening:true}];assert.equal(dashboard([],[],ledger,settings,"2026-10-18").cash,500000)});
