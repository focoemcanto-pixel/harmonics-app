import { test } from "node:test";
import assert from "node:assert/strict";
import { eventSummary } from "../lib/operational-finance/model.mjs";
const e={id:"e",agreed_amount:0},s={event_id:"e",status:"checked",contract_cents:0,costs:[{id:"m",category:"musician",amount_cents:50000}]};
test("pagamento legado continua reduzindo open do custo",()=>{const r=eventSummary(e,s,[{id:"p",event_id:"e",cost_id:"m",kind:"payment",amount_cents:20000,occurred_on:"2026-10-18"}]);assert.equal(r.costs[0].paid,20000);assert.equal(r.costs[0].open,30000)});
