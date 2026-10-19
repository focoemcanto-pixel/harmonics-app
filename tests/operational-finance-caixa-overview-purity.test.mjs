import { test } from "node:test";
import assert from "node:assert/strict";
import { receivablesOverview } from "../lib/operational-finance/receivables.mjs";
test("overview é leitura pura",()=>{const events=[{id:"e",client_name:"C",event_date:"2026-11-01",agreed_amount:100}],sheets=[{event_id:"e",status:"checked",contract_cents:10000,costs:[]}],before=JSON.stringify({events,sheets});receivablesOverview(events,sheets,[],null,"2026-10-18");assert.equal(JSON.stringify({events,sheets}),before)});
