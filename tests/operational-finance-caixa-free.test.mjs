import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-11-01",agreed_amount:0},s={event_id:"e",status:"checked",contract_cents:0,costs:[{id:"m",category:"musician",amount_cents:30000}]};
test("free é caixa atual menos custos futuros",()=>{const r=dashboard([e],[s],[],{opening_on:"2026-10-01",opening_cents:100000},"2026-10-18");assert.equal(r.free,70000)});
