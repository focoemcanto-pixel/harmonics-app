import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-11-01",agreed_amount:1000},s={event_id:"e",status:"checked",contract_cents:100000,costs:[{id:"m",category:"musician",amount_cents:30000}]},settings={opening_on:"2026-10-01",opening_cents:500000};
test("empréstimo/retirada mexe em caixa mas não no resultado econômico",()=>{const base=dashboard([e],[s],[],settings,"2026-10-18"),withWithdrawal=dashboard([e],[s],[{id:"w",kind:"withdrawal",amount_cents:100000,occurred_on:"2026-10-18",in_opening:false}],settings,"2026-10-18");assert.equal(withWithdrawal.margin,base.margin);assert.equal(withWithdrawal.cash,base.cash-100000)});
