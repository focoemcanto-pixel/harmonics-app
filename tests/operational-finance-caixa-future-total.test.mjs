import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-11-01",agreed_amount:0},s={event_id:"e",status:"checked",contract_cents:0,costs:[{id:"m",category:"musician",amount_cents:30000},{id:"o",category:"transporte",amount_cents:12000}]};
test("custos futuros consolidam todas as categorias",()=>{const r=dashboard([e],[s],[],{opening_on:"2026-10-01",opening_cents:0},"2026-10-18");assert.equal(r.musician,30000);assert.equal(r.other,12000);assert.equal(r.committed,42000)});
