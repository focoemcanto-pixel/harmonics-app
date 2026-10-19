import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
const e={id:"e",client_name:"C",event_date:"2026-10-10",agreed_amount:100},s={event_id:"e",status:"checked",contract_cents:10000,expected_receipt_on:"2026-10-08",costs:[]};
test("saldo antigo continua checklist como vencido",()=>{const r=receivablesOverview([e],[s],[],null,"2026-10-18");assert.equal(r.rows[0].open,10000);assert.equal(r.rows[0].overdue,true)});
