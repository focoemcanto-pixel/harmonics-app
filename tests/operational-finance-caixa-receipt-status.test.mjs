import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
const e={id:"e",client_name:"C",event_date:"2026-11-01",agreed_amount:100},s={event_id:"e",status:"checked",contract_cents:10000,costs:[]};
test("sem entrada pending e com parcial partial",()=>{assert.equal(receivablesOverview([e],[s],[],null,"2026-10-18").rows[0].status,"pending");assert.equal(receivablesOverview([e],[s],[{id:"r",event_id:"e",kind:"receipt",amount_cents:5000,occurred_on:"2026-10-18"}],null,"2026-10-18").rows[0].status,"partial")});
