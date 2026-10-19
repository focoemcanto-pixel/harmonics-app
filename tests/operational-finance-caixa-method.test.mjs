import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
const e={id:"e",client_name:"C",event_date:"2026-11-01",agreed_amount:100},s={event_id:"e",status:"checked",contract_cents:10000,costs:[]};
test("histórico preserva método do lançamento",()=>{const r=receivablesOverview([e],[s],[{id:"r",event_id:"e",kind:"receipt",amount_cents:1000,occurred_on:"2026-10-18",method:"Pix"}],null,"2026-10-18");assert.equal(r.rows[0].receipts[0].method,"Pix")});
