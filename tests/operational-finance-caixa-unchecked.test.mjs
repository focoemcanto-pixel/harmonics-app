import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-11-01",agreed_amount:1000},s={event_id:"e",status:"draft",contract_cents:100000,costs:[{id:"m",category:"musician",amount_cents:50000}]},settings={opening_on:"2026-10-01",opening_cents:0};
test("evento não conferido é sinalizado mas não contamina projeção",()=>{const r=dashboard([e],[s],[],settings,"2026-10-18");assert.equal(r.unchecked,1);assert.equal(r.receivable,0);assert.equal(r.committed,0)});
