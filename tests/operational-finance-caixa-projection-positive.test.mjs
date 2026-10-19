import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-11-01",agreed_amount:1000},s={event_id:"e",status:"checked",contract_cents:100000,costs:[{id:"m",category:"musician",amount_cents:40000}]};
test("receita futura maior que compromisso gera projeção positiva",()=>assert.equal(dashboard([e],[s],[],{opening_on:"2026-10-01",opening_cents:0},"2026-10-18").projected,60000));
