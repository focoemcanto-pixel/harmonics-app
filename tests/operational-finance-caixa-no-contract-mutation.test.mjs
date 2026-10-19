import { test } from "node:test";
import assert from "node:assert/strict";
import { eventSummary } from "../lib/operational-finance/model.mjs";
test("recebimento não reescreve contrato",()=>{const event={id:"e",agreed_amount:1000},sheet={event_id:"e",status:"checked",contract_cents:100000,costs:[]},r=eventSummary(event,sheet,[{id:"r",event_id:"e",kind:"receipt",amount_cents:25000,occurred_on:"2026-10-18"}]);assert.equal(r.contract,100000);assert.equal(r.received,25000);assert.equal(r.open,75000)});
