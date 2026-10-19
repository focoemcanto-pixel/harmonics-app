import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-12-01",agreed_amount:2000},s={event_id:"e",status:"checked",contract_cents:200000,costs:[{id:"m",category:"musician",amount_cents:80000}]},settings={opening_on:"2026-10-01",opening_cents:300000};
test("conversão de recebível em caixa mantém projeção",()=>{const a=dashboard([e],[s],[],settings,"2026-10-18"),b=dashboard([e],[s],[{id:"r",event_id:"e",kind:"receipt",amount_cents:50000,occurred_on:"2026-10-18",in_opening:false}],settings,"2026-10-18");assert.equal(a.projected,b.projected);assert.equal(b.cash,a.cash+50000);assert.equal(b.receivable,a.receivable-50000)});
