import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
test("evento cancelado não entra no checklist",()=>{const e={id:"e",client_name:"Cancelado",event_date:"2026-11-01",agreed_amount:100,status:"cancelado"},s={event_id:"e",status:"checked",contract_cents:10000,costs:[]};assert.equal(receivablesOverview([e],[s],[],null,"2026-10-18").rows.length,0)});
