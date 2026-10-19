import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-11-01",agreed_amount:20000},s={event_id:"e",status:"checked",contract_cents:2000000,costs:[{id:"m",category:"musician",amount_cents:1300000}]},settings={opening_on:"2026-10-01",opening_cents:1000000};
test("retirada emprestada mostra se contratos futuros recompõem caixa",()=>{const w={id:"w",kind:"withdrawal",amount_cents:800000,occurred_on:"2026-10-18",in_opening:false},r=dashboard([e],[s],[w],settings,"2026-10-18");assert.equal(r.cash,200000);assert.equal(r.receivable,2000000);assert.equal(r.committed,1300000);assert.equal(r.projected,900000)});
