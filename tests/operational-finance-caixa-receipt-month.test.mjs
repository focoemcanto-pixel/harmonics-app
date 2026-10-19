import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
const e={id:"e",client_name:"Cliente",event_date:"2026-12-10",agreed_amount:1000},s={event_id:"e",status:"checked",contract_cents:100000,expected_receipt_on:"2026-12-08",costs:[]};
test("entrada realizada pertence ao mês em que dinheiro entrou",()=>{const r=receivablesOverview([e],[s],[{id:"r",event_id:"e",kind:"receipt",amount_cents:25000,occurred_on:"2026-10-18"}],null,"2026-10-18");assert.equal(r.months.find(x=>x.month==="2026-10").realized,25000);assert.equal(r.months.find(x=>x.month==="2026-12").remaining,75000)});
