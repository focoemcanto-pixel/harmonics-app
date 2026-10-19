import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
const e={id:"e",client_name:"Cliente",event_date:"2026-11-01",agreed_amount:1000},s={event_id:"e",status:"checked",contract_cents:100000,costs:[]};
test("histórico ordena recebimentos do mais recente",()=>{const ledger=[{id:"a",event_id:"e",kind:"receipt",amount_cents:1000,occurred_on:"2026-10-01"},{id:"b",event_id:"e",kind:"receipt",amount_cents:1000,occurred_on:"2026-10-18"}],r=receivablesOverview([e],[s],ledger,null,"2026-10-18");assert.equal(r.rows[0].receipts[0].id,"b")});
