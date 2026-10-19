import { test } from "node:test";
import assert from "node:assert/strict";
import { eventSummary } from "../lib/operational-finance/model.mjs";
test("evento antigo sem receipt continua com saldo aberto",()=>{const r=eventSummary({id:"e",event_date:"2026-01-01",agreed_amount:100},{event_id:"e",status:"checked",contract_cents:10000,costs:[]},[]);assert.equal(r.open,10000)});
