import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-10-17",agreed_amount:0},s={event_id:"e",status:"checked",contract_cents:0,costs:[{id:"x",category:"sonorização",amount_cents:40000}]};
test("sonorização de evento passado deixa de ser custo futuro",()=>assert.equal(dashboard([e],[s],[],{opening_on:"2026-10-01",opening_cents:0},"2026-10-18").other,0));
