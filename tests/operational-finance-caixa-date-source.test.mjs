import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyCommitments } from "../lib/operational-finance/model.mjs";
const e={id:"e",client_name:"C",event_date:"2026-11-20",agreed_amount:100},s={event_id:"e",status:"checked",contract_cents:10000,expected_receipt_on:"2026-11-10",costs:[]};
test("planejamento identifica previsão definida manualmente",()=>{const p=monthlyCommitments([e],[s],[],"2026-10-18"),r=p.months.find(x=>x.month==="2026-11").receipts[0];assert.equal(r.date_source,"manual");assert.equal(r.due_on,"2026-11-10")});
