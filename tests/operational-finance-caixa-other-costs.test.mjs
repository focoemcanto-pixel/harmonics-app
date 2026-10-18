import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-10-20",agreed_amount:0},s={event_id:"e",status:"checked",contract_cents:0,costs:[{id:"sound",category:"sonorização",amount_cents:50000}]},settings={opening_on:"2026-10-01",opening_cents:0};
test("outros custos previstos deixam de pesar após o evento",()=>{assert.equal(dashboard([e],[s],[],settings,"2026-10-20").other,50000);assert.equal(dashboard([e],[s],[],settings,"2026-10-21").other,0)});
