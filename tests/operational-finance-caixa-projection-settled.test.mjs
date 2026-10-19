import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-11-01",agreed_amount:100},s={event_id:"e",status:"checked",contract_cents:10000,costs:[{id:"m",category:"musician",amount_cents:3000}]};
test("quitação antes do evento mantém projeção e zera receivable",()=>{const settings={opening_on:"2026-10-01",opening_cents:0},a=dashboard([e],[s],[],settings,"2026-10-18"),b=dashboard([e],[s],[{id:"r",event_id:"e",kind:"receipt",amount_cents:10000,occurred_on:"2026-10-18",in_opening:false}],settings,"2026-10-18");assert.equal(b.receivable,0);assert.equal(a.projected,b.projected)});
