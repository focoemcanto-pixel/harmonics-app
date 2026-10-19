import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
const e={id:"e",client_name:"C",event_date:"2026-11-01",agreed_amount:1000},s={event_id:"e",status:"checked",contract_cents:100000,costs:[{id:"m",category:"musician",amount_cents:40000}]};
test("retirada aparece separada e não reduz margem econômica",()=>{const r=receivablesOverview([e],[s],[{id:"w",kind:"withdrawal",amount_cents:20000,occurred_on:"2026-10-18",in_opening:false}],null,"2026-10-18");assert.equal(r.totals.margin,60000);assert.equal(r.totals.withdrawals,20000)});
