import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-11-01",agreed_amount:0},s={event_id:"e",status:"checked",contract_cents:0,costs:[{id:"m",category:"musician",amount_cents:50000}]},settings={opening_on:"2026-10-01",opening_cents:100000};
test("pagamento legado já registrado reduz compromisso futuro",()=>{const payment={id:"p",event_id:"e",cost_id:"m",kind:"payment",amount_cents:20000,occurred_on:"2026-10-18",in_opening:false},r=dashboard([e],[s],[payment],settings,"2026-10-18");assert.equal(r.musician,30000);assert.equal(r.cash,80000)});
