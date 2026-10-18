import { test } from "node:test";
import assert from "node:assert/strict";
import { eventSummary } from "../lib/operational-finance/model.mjs";
const e={id:"e",agreed_amount:1000},s={event_id:"e",status:"checked",contract_cents:100000,costs:[{id:"m",category:"musician",amount_cents:40000}]};
test("margem é a mesma antes e depois do cliente pagar",()=>{const a=eventSummary(e,s,[]),b=eventSummary(e,s,[{id:"r",event_id:"e",kind:"receipt",amount_cents:100000}]);assert.equal(a.margin,b.margin);assert.equal(a.margin,60000)});
