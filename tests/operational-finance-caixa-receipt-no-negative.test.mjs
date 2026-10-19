import { test } from "node:test";
import assert from "node:assert/strict";
import { eventSummary } from "../lib/operational-finance/model.mjs";
test("pagamento acima do contrato zera open e separa excesso",()=>{const r=eventSummary({id:"e",agreed_amount:100},{event_id:"e",status:"checked",contract_cents:10000,costs:[]},[{id:"r",event_id:"e",kind:"receipt",amount_cents:15000,occurred_on:"2026-10-18"}]);assert.equal(r.open,0);assert.equal(r.overpayment,5000)});
