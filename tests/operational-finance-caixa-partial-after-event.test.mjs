import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-10-17",agreed_amount:1000},s={event_id:"e",status:"checked",contract_cents:100000,costs:[{id:"m",category:"musician",amount_cents:40000}]},settings={opening_on:"2026-10-01",opening_cents:0};
test("cliente parcial continua devendo depois do evento sem custo futuro",()=>{const r=dashboard([e],[s],[{id:"r",event_id:"e",kind:"receipt",amount_cents:60000,occurred_on:"2026-10-16",in_opening:false}],settings,"2026-10-18");assert.equal(r.cash,60000);assert.equal(r.receivable,40000);assert.equal(r.committed,0);assert.equal(r.projected,100000)});
