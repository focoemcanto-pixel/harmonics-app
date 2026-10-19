import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
const e={id:"e",client_name:"Cliente",event_date:"2026-11-10",agreed_amount:1000},s={event_id:"e",status:"checked",contract_cents:100000,costs:[]};
test("estornar recebimento reabre o saldo previsto",()=>{const ledger=[{id:"r",event_id:"e",kind:"receipt",amount_cents:100000,occurred_on:"2026-10-18"},{id:"x",event_id:"e",kind:"reversal",reverses_id:"r",amount_cents:100000,occurred_on:"2026-10-18"}],r=receivablesOverview([e],[s],ledger,null,"2026-10-18");assert.equal(r.rows[0].received,0);assert.equal(r.rows[0].open,100000);assert.equal(r.rows[0].status,"pending")});
