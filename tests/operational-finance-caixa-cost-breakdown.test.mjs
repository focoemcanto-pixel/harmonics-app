import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
const e={id:"e",client_name:"Cliente",event_date:"2026-11-01",agreed_amount:1000},s={event_id:"e",status:"checked",contract_cents:100000,costs:[{id:"m",category:"musician",amount_cents:30000},{id:"x",category:"transporte",amount_cents:10000}]},settings={opening_on:"2026-10-01",opening_cents:0};
test("expõe custo econômico total e impacto futuro separado",()=>{const r=receivablesOverview([e],[s],[],settings,"2026-10-18");assert.equal(r.totals.costs,40000);assert.equal(r.cash.futureMusicians,30000);assert.equal(r.cash.futureOther,10000)});
