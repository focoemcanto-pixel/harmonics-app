import { test } from "node:test";
import assert from "node:assert/strict";
import { eventSummary, dashboard } from "../lib/operational-finance/model.mjs";
const e={id:"e",event_date:"2026-10-01",agreed_amount:100},s={event_id:"e",status:"checked",contract_cents:10000,costs:[{id:"m",category:"musician",amount_cents:3000}]};
test("evento passado mantém custo econômico embora obrigação futura zere",()=>{assert.equal(eventSummary(e,s,[]).total,3000);assert.equal(dashboard([e],[s],[],{opening_on:"2026-10-01",opening_cents:0},"2026-10-18").committed,0)});
