import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
const e={id:"e",client_name:"Cliente",event_date:"2026-11-01",agreed_amount:1000},s={event_id:"e",status:"checked",contract_cents:100000,costs:[{id:"m",category:"musician",amount_cents:30000}]};
test("totais econômicos permanecem íntegros após recebimento parcial",()=>{const r=receivablesOverview([e],[s],[{id:"r",event_id:"e",kind:"receipt",amount_cents:40000,occurred_on:"2026-10-18"}],null,"2026-10-18");assert.equal(r.totals.contract,100000);assert.equal(r.totals.costs,30000);assert.equal(r.totals.margin,70000);assert.equal(r.totals.open,60000)});
