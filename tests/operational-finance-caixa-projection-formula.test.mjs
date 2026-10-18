import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-11-01",agreed_amount:800},s={event_id:"e",status:"checked",contract_cents:80000,costs:[{id:"m",category:"musician",amount_cents:120000}]};
test("caixa projetado = atual + restante - custos futuros",()=>{const r=dashboard([e],[s],[],{opening_on:"2026-10-01",opening_cents:1100000},"2026-10-18");assert.equal(r.projected,r.cash+r.receivable-r.committed)});
