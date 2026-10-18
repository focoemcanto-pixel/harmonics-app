import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-10-10",agreed_amount:1000},s={event_id:"e",status:"checked",contract_cents:100000,costs:[{id:"m",category:"musician",amount_cents:30000}]},settings={opening_on:"2026-10-01",opening_cents:0};
test("evento passado zera custo futuro mas mantém valor ainda não recebido",()=>{const r=dashboard([e],[s],[],settings,"2026-10-18");assert.equal(r.musician,0);assert.equal(r.receivable,100000);assert.equal(r.projected,100000)});
