import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-11-01",agreed_amount:100},s={event_id:"e",status:"checked",contract_cents:10000,costs:[{id:"m",category:"musician",amount_cents:50000}]},settings={opening_on:"2026-10-01",opening_cents:10000};
test("projeção pode ficar negativa e expõe necessidade real",()=>{assert.equal(dashboard([e],[s],[],settings,"2026-10-18").projected,-30000)});
