import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const event={id:"e",event_date:"2026-11-01",agreed_amount:0};
const sheet={event_id:"e",status:"checked",contract_cents:0,costs:[{id:"m",category:"musician",amount_cents:50000,excluded:true}]};
test("item desconsiderado não pesa no caixa futuro",()=>{const result=dashboard([event],[sheet],[],{opening_on:"2026-10-01",opening_cents:0},"2026-10-18");assert.equal(result.committed,0)});
