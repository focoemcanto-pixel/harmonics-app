import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
test("nome exibido vem do evento",()=>{const e={id:"e",client_name:"Cliente X",event_date:"2026-11-01",agreed_amount:1},s={event_id:"e",status:"checked",contract_cents:100,costs:[]};assert.equal(receivablesOverview([e],[s],[],null,"2026-10-18").rows[0].event_name,"Cliente X")});
