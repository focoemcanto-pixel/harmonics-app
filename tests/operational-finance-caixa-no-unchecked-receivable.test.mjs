import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-11-01",agreed_amount:1000},s={event_id:"e",status:"draft",contract_cents:100000,costs:[]};
test("draft não infla caixa projetado",()=>{const r=dashboard([e],[s],[],{opening_on:"2026-10-01",opening_cents:0},"2026-10-18");assert.equal(r.projected,0);assert.equal(r.unchecked,1)});
