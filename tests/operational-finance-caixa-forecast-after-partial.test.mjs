import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
const e={id:"e",client_name:"Cliente",event_date:"2026-11-10",agreed_amount:1000},s={event_id:"e",status:"checked",contract_cents:100000,expected_receipt_on:"2026-11-08",costs:[]};
test("parcial reduz previsão futura exatamente no valor recebido",()=>{const r=receivablesOverview([e],[s],[{id:"r",event_id:"e",kind:"receipt",amount_cents:40000,occurred_on:"2026-10-18"}],null,"2026-10-18");assert.equal(r.months.find(x=>x.month==="2026-11").remaining,60000)});
