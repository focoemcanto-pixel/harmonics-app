import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-10-20",agreed_amount:100},s={event_id:"e",status:"checked",contract_cents:10000,costs:[{id:"m",category:"musician",amount_cents:6000}]},settings={opening_on:"2026-10-01",opening_cents:0};
test("virada de data altera somente compromisso futuro",()=>{const before=dashboard([e],[s],[],settings,"2026-10-20"),after=dashboard([e],[s],[],settings,"2026-10-21");assert.equal(before.committed,6000);assert.equal(after.committed,0);assert.equal(before.receivable,after.receivable)});
