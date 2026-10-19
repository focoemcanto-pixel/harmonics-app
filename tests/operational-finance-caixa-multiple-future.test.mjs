import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const events=[{id:"a",event_date:"2026-10-20",agreed_amount:100},{id:"b",event_date:"2026-10-21",agreed_amount:200}],sheets=[{event_id:"a",status:"checked",contract_cents:10000,costs:[{id:"a1",category:"musician",amount_cents:3000}]},{event_id:"b",status:"checked",contract_cents:20000,costs:[{id:"b1",category:"musician",amount_cents:5000}]}];
test("projeção consolida agenda futura",()=>{const r=dashboard(events,sheets,[],{opening_on:"2026-10-01",opening_cents:0},"2026-10-18");assert.equal(r.receivable,30000);assert.equal(r.committed,8000);assert.equal(r.projected,22000)});
