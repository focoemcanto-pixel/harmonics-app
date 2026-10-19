import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
const e={id:"e",client_name:"Cliente",event_date:"2026-11-01",agreed_amount:1000},s={event_id:"e",status:"checked",contract_cents:100000,costs:[]};
test("múltiplos recebimentos permanecem visíveis no histórico",()=>{const ledger=[{id:"r1",event_id:"e",kind:"receipt",amount_cents:20000,occurred_on:"2026-10-01"},{id:"r2",event_id:"e",kind:"receipt",amount_cents:30000,occurred_on:"2026-10-02"}],r=receivablesOverview([e],[s],ledger,null,"2026-10-18");assert.equal(r.rows[0].received,50000);assert.equal(r.rows[0].open,50000);assert.equal(r.rows[0].receipts.length,2)});
