import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-10-17",agreed_amount:0},s={event_id:"e",status:"checked",contract_cents:0,costs:[{id:"m",category:"musician",amount_cents:50000}]};
test("sem nenhum payment custo passado já não pesa no futuro",()=>assert.equal(dashboard([e],[s],[],{opening_on:"2026-10-01",opening_cents:0},"2026-10-18").committed,0));
