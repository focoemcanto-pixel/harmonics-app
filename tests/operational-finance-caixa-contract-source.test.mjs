import { test } from "node:test";
import assert from "node:assert/strict";
import { eventSummary } from "../lib/operational-finance/model.mjs";
test("contrato salvo na ficha prevalece sobre valor bruto do evento",()=>{const r=eventSummary({id:"e",agreed_amount:999},{event_id:"e",status:"checked",contract_cents:123400,costs:[]},[]);assert.equal(r.contract,123400)});
