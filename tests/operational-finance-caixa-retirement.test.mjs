import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-11-01",agreed_amount:100},s={event_id:"e",status:"checked",contract_cents:10000,costs:[]};
test("retirada mexe no caixa mas cliente continua devendo",()=>{const r=dashboard([e],[s],[{id:"w",kind:"withdrawal",amount_cents:5000,occurred_on:"2026-10-18",in_opening:false}],{opening_on:"2026-10-01",opening_cents:10000},"2026-10-18");assert.equal(r.cash,5000);assert.equal(r.receivable,10000)});
