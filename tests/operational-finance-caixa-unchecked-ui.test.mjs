import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
test("evento draft fica fora do checklist reconciliado",()=>{const e={id:"e",client_name:"C",event_date:"2026-11-01",agreed_amount:100},s={event_id:"e",status:"draft",contract_cents:10000,costs:[]};assert.equal(receivablesOverview([e],[s],[],null,"2026-10-18").rows.length,0)});
