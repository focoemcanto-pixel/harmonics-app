import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboard } from "../lib/operational-finance/model.mjs";
const events=[1,2,3,4].map(i=>({id:`e${i}`,event_date:"2026-10-17",agreed_amount:0})),sheets=events.map((e,i)=>({event_id:e.id,status:"checked",contract_cents:0,costs:[{id:`m${i}`,category:"musician",amount_cents:10000}]}));
test("quatro eventos passados não exigem quatro baixas manuais",()=>assert.equal(dashboard(events,sheets,[],{opening_on:"2026-10-01",opening_cents:0},"2026-10-18").committed,0));
