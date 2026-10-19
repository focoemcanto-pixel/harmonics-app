import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const settings={opening_on:"2026-10-01",opening_cents:100000};
test("estorno neutraliza movimento no caixa",()=>{const receipt={id:"r",kind:"receipt",amount_cents:50000,occurred_on:"2026-10-18",in_opening:false},reversal={id:"x",kind:"reversal",reverses_id:"r",amount_cents:50000,occurred_on:"2026-10-18"};assert.equal(dashboard([],[],[receipt,reversal],settings,"2026-10-18").cash,100000)});
