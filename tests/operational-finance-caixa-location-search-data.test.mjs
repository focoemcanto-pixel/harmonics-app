import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
const e={id:"e",client_name:"Cliente",event_date:"2026-11-01",location_name:"Salvador",agreed_amount:100},s={event_id:"e",status:"checked",contract_cents:10000,costs:[]};
test("linha expõe local do evento",()=>assert.equal(receivablesOverview([e],[s],[],null,"2026-10-18").rows[0].location_name,"Salvador"));
