import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-11-01",agreed_amount:100},s={event_id:"e",status:"checked",contract_cents:10000,costs:[{id:"m",category:"musician",amount_cents:3000}]};
test("entrada histórica reduz recebível sem duplicar caixa",()=>{const r=dashboard([e],[s],[{id:"r",event_id:"e",kind:"receipt",amount_cents:4000,occurred_on:"2026-10-10",in_opening:true}],{opening_on:"2026-10-01",opening_cents:50000},"2026-10-18");assert.equal(r.projected,53000)});
