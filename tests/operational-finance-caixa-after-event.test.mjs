import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-10-17",agreed_amount:1000},s={event_id:"e",status:"checked",contract_cents:100000,costs:[{id:"m",category:"musician",amount_cents:40000}]},settings={opening_on:"2026-10-01",opening_cents:0};
test("dia seguinte realiza o cachê: sai do compromisso e reduz o caixa real",()=>{const r=dashboard([e],[s],[],settings,"2026-10-18");assert.equal(r.committed,0);assert.equal(r.cash,-40000);assert.equal(r.receivable,100000);assert.equal(r.projected,60000)});
