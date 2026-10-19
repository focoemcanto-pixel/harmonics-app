import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
const e={id:"e",client_name:"Cliente",event_date:"2026-11-10",agreed_amount:1000},s={event_id:"e",status:"checked",contract_cents:100000,expected_receipt_on:"2026-11-05",costs:[]};
test("checklist mantém data prevista enquanto houver saldo",()=>{const r=receivablesOverview([e],[s],[],null,"2026-10-18");assert.equal(r.rows[0].due_on,"2026-11-05");assert.equal(r.rows[0].open,100000)});
