import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-11-01",agreed_amount:1000},s={event_id:"e",status:"checked",contract_cents:100000,costs:[{id:"m",category:"musician",amount_cents:30000}]},settings={opening_on:"2026-10-01",opening_cents:500000};
test("margem econômica independe do saldo inicial",()=>{assert.equal(dashboard([e],[s],[],settings,"2026-10-18").margin,70000)});
