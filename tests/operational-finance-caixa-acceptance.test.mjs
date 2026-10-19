import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
test("caixa projetado responde ao saldo futuro após retirada",()=>{const e={id:"e",event_date:"2026-11-01",agreed_amount:1000},s={event_id:"e",status:"checked",contract_cents:100000,costs:[{id:"m",category:"musician",amount_cents:70000}]},w={id:"w",kind:"withdrawal",amount_cents:50000,occurred_on:"2026-10-18",in_opening:false},r=dashboard([e],[s],[w],{opening_on:"2026-10-01",opening_cents:50000},"2026-10-18");assert.equal(r.cash,0);assert.equal(r.projected,30000)});
